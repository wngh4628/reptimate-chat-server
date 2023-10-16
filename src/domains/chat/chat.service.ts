/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ChatMemberRepository } from './repositories/chat-member.repository';
import { ChatRoomDto, CreateRoomDto } from './dtos/chat-room.dto';
import { DataSource, Not, Raw } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMember } from './entities/chat-member.entity';
import { Page, PageRequest } from 'src/core/page';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ChatConversation } from './entities/chat-conversation.entity';
import { chat, chatType } from './helpers/constants';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { UserRepository } from '../user/repositories/user.repository';
import { ChatConversationRepository } from './repositories/chat-conversation.repository';
interface YourChatMessageType {
  userIdx: number;
  action: string;
  message: string;
}
@Injectable()
export class ChatService {
  constructor(
    private chatMemberRepository: ChatMemberRepository,
    private dataSource: DataSource,
    private readonly redisService: RedisService,
    private userRepository: UserRepository,
    private chatConversationRepository: ChatConversationRepository,
  ) {
  }
  async findChatRoom(userIdx: number, oppositeIdx: number) {
    const result = await this.chatMemberRepository.findOne({
      where: {
        userIdx: userIdx,
        oppositeIdx: oppositeIdx,
      },
    });

    if(!result){
        throw new NotFoundException(HttpErrorConstants.CHATROOM_NOT_EXIST);
    }

    return result.chatRoomIdx;
  }
  async createRoom(dto: CreateRoomDto, userIdx: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const chatRoom = new ChatRoom();
      //1. 방 생성
      const result = await queryRunner.manager.save(chatRoom);
      //2. 채팅 맴버 테이블에 내 정보 등록
      const myInfo = ChatMember.From(result.idx, userIdx, dto.oppositeIdx);
      //3. 채팅 맴버 테이블에 상대방 정보 등록
      await queryRunner.manager.save(myInfo); // Create an instance of BoardImage entity class
      const oppositeInfo = ChatMember.From(
        result.idx,
        dto.oppositeIdx,
        userIdx,
      );
      await queryRunner.manager.save(oppositeInfo); // Create an instance of BoardImage entity class
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async getChatRoomList(
    pageRequest: PageRequest,
    userIdx: number,
  ): Promise<Page<ChatMember>> {
    // 1. 내가 속해있는 모든 채팅방들에 대한 정보를 불러온다 (방의 번호와, 그 방에 같이있는 상대방의 idx는 무엇인지 등)
    const [datas, totalCount] =
      await this.chatMemberRepository.findAndCountByUserIdx(
        pageRequest,
        userIdx,
      );
    const chatRoomInfoArr = [];
    
    for (const chatRoomInfo of datas) {
      // 2. 채팅방별 속해있는 상대방의 정보를 불러와서 담아준다
      const userDetails = await this.findUserInfo(chatRoomInfo.oppositeIdx);
      chatRoomInfo.UserInfo = userDetails;
      
      // 3. 채팅방별 안읽은 채팅의 개수를 불러와서 담아준다
      const unreadCount = await this.chatConversationRepository.getUnreadCount(chatRoomInfo.chatRoomIdx, chatRoomInfo.oppositeIdx)
      chatRoomInfo.unreadCount = unreadCount

      // 4. 2,3번의 정보가 추가된 채팅방정보 객체를 새로운 배열(응답용)에 담아준다
      chatRoomInfoArr.push(chatRoomInfo);
    }

    const result = new Page<ChatMember>(
      totalCount,
      chatRoomInfoArr, // 채팅방 정보 + 속해있는 상대방의 정보
      pageRequest,
    );

    return result;
  }
  async getChatData(
    pageRequest: PageRequest,
    roomIdx: number,
    userIdx: number,
  ): Promise<YourChatMessageType[]> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      //방 정보 조회
      const chatMemberInfo = await queryRunner.manager.findOne(ChatMember, {
        where: {
          userIdx: userIdx,
          chatRoomIdx: roomIdx,
        },
      });
      if (!chatMemberInfo) {
        throw new NotFoundException(HttpErrorConstants.CHATROOM_NOT_EXIST);
      }
      let roomOutScore = 0;
      if (chatMemberInfo.roomOut !== null) {
        roomOutScore = new Date(chatMemberInfo.roomOut).getTime();
      }
      //1. 마리아DB 읽음 처리
        // 1-1. 상대방이 보낸 채팅중 안읽은 채팅만 불러온다
      const chatConversations = await queryRunner.manager.find(
        ChatConversation,
        {
          where: {
            roomIdx: roomIdx,
            type: chatType.PERSONAL,
            userIdx: Not(userIdx),
            action: 'send',
          },
        },
      );
        // 1-2. '안읽음 -> 읽음'으로 상태를 변경한다.
      for (const conversation of chatConversations) {
        conversation.action = 'read';
        await queryRunner.manager.save(conversation);
      }
      await queryRunner.manager.save(chatConversations);

      //2. 레디스 읽음 처리
      const key = `personal-chat${roomIdx}`;
      const redis = this.redisService.getClient();
      if (pageRequest.page === 1) {
        const getData = await redis.zrevrange(key, 0, -1, 'WITHSCORES');
        for (let i = 0; i < getData.length; i += 2) {
          const jsonMember = getData[i];
          const timestamp = getData[i + 1];

          const data = JSON.parse(jsonMember);
          if (data.userIdx !== userIdx && data.action === 'send') {
            data.action = 'read';
            const updatedJsonMember = JSON.stringify(data);
            await redis.zrem(key, jsonMember);
            await redis.zadd(key, timestamp, updatedJsonMember);
          } else {
            break;
          }
        }
      }
      //3. 채팅에 대한 정보를 레디스에서 불러온다.
      const getData = await redis.zrevrange(
        key,
        (pageRequest.page - 1) * pageRequest.size,
        (pageRequest.page - 1) * pageRequest.size + pageRequest.size - 1,
        'WITHSCORES',
      );

      // Filter out the conversations with score greater than roomOutScore
      const result: YourChatMessageType[] = [];
      for (let i = 0; i < getData.length; i += 2) {
        const jsonMember = getData[i];
        const timestamp = parseInt(getData[i + 1]);

        if (timestamp > roomOutScore) {
          const data = JSON.parse(jsonMember) as YourChatMessageType;
          result.push(data);
        }
      }
      //4. 레디스에 저장된 데이터 수가 20개 미만이면, 나머지는 마리아DB에서 조회해온다.
      if (result.length < pageRequest.size) {
        const skip = (pageRequest.page - 1) * pageRequest.size + result.length;
        const limit = pageRequest.size - result.length;
        const chatConversations = await queryRunner.manager.find(
          ChatConversation,
          {
            where: {
              roomIdx: roomIdx,
              type: chatType.PERSONAL,
              score: Raw((alias) => `${alias} > ${roomOutScore}`),
            },
            order: {
              createdAt: 'DESC', // create_at을 기준으로 최신순으로 정렬합니다.
            },
            skip: skip,
            take: limit,
          },
        );
        for (const chatConversation of chatConversations) {
          const jsonMessage = {
            userIdx: chatConversation.userIdx,
            roomIdx: chatConversation.roomIdx,
            message: chatConversation.message,
            action: chatConversation.action,
            datetime: chatConversation.createdAt,
          };
          const key = `personal-chat${chatConversation.roomIdx}`;
          await redis.zadd(
            key,
            chatConversation.score,
            JSON.stringify(jsonMessage),
          );
          result.push(jsonMessage);
        }
      }
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async chatBan(dto: ChatRoomDto, userIdx: number) {
    const redis = this.redisService.getClient();
    const key = `userBan${userIdx}`;
    const result = await this.chatMemberRepository.findOne({
      where: {
        userIdx: userIdx,
        oppositeIdx: dto.oppositeIdx,
      },
    });
    if (result.state === chat.BAN) {
      result.state = chat.NORMAL;
      // 현재 Set 키에 저장된 모든 멤버들 조회
      // const existingMembers = await redis.smembers(key);
      // // dto.oppositeIdx와 일치하는 멤버 제거
      // const oppositeIdxToDelete = dto.oppositeIdx.toString();
      // const updatedMembers = existingMembers.filter(
      //   (member) => member !== oppositeIdxToDelete,
      // );
      // // Set 키에 업데이트된 멤버들을 다시 저장
      // await redis.del(key);
      // if (updatedMembers.length > 0) {
      //   await redis.sadd(key, updatedMembers);
      //}
    } else if (result.state === chat.NORMAL) {
      result.state = chat.BAN;
      // Set 키에 업데이트된 멤버 저장
      //await redis.sadd(key, dto.oppositeIdx); // 문자열로 변환된 자료구조를 Redis에 저장
    }
    await this.chatMemberRepository.save(result);
    return result.chatRoomIdx;
  }
  async chatRoomOut(roomIdx: number, userIdx: number) {
    const date = new Date();
    const result: ChatMember = await this.chatMemberRepository.findOne({
      where: {
        userIdx: userIdx,
        chatRoomIdx: roomIdx,
      },
    });
    result.roomOut = date;
    await this.chatMemberRepository.save(result);
    return result.chatRoomIdx;
  }
  findUserInfo = async (result) => {
    const userInfo = await this.userRepository.findOne({
      where: {
        idx: result,
      },
    });
    const userDetails = {
      idx: userInfo.idx,
      nickname: userInfo.nickname,
      profilePath: userInfo.profilePath,
    };
    return userDetails;
  };
}
