/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PageRequest } from 'src/core/page';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ChatConversation } from './entities/chat-conversation.entity';
import { chat, chatType } from './helpers/constants';
import { AuctionAlert } from './entities/auction_alert.entity';
import { AuctionUser } from './entities/auction_user.entity';
import { User } from '../user/entities/user.entity';
interface YourChatMessageType {
  userIdx: number;
  action: string;
  message: string;
}
interface messageList {
  list: YourChatMessageType[];
  userInfo: string[];
}

@Injectable()
export class AuctionChatService {
  constructor(
    private dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}
  async getChatData(
    pageRequest: PageRequest,
    roomIdx: number,
  ): Promise<messageList> {
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      const key = `auction-chat${roomIdx}`;
      const redis = this.redisService.getClient();
      const result: messageList = {} as messageList;
      //1. 게시글에 대한 정보를 레디스에서 불러온다.
      const getData = await redis.zrevrange(
        key,
        (pageRequest.page - 1) * pageRequest.size,
        (pageRequest.page - 1) * pageRequest.size + pageRequest.size - 1,
        'WITHSCORES',
      );

      // Filter out the conversations with score greater than roomOutScore
      const conversationList: YourChatMessageType[] = [];
      for (let i = 0; i < getData.length; i += 2) {
        const jsonMember = getData[i];
        const data = JSON.parse(jsonMember) as YourChatMessageType;
        conversationList.push(data);
      }
      //2. 레디스에 저장된 데이터 수가 20개 미만이면, 마리아DB에서 조회해온다.
      if (conversationList.length < pageRequest.size) {
        const skip =
          (pageRequest.page - 1) * pageRequest.size + conversationList.length;
        const limit = pageRequest.size - conversationList.length;
        const chatConversations = await queryRunner.manager.find(
          ChatConversation,
          {
            where: {
              roomIdx: roomIdx,
              type: chatType.AUCTION,
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
          const key = `auction-chat${chatConversation.roomIdx}`;
          await redis.zadd(
            key,
            chatConversation.score,
            JSON.stringify(jsonMessage),
          );
          conversationList.push(jsonMessage);
        }
      }
      //3. 유저 정보 조회
      const userkey = `auction-user-list-${roomIdx}`;
      const userInfoList = await redis.smembers(userkey);
      if (userInfoList.length === 0) {
        const userData = await queryRunner.manager.find(AuctionUser, {
          where: {
            auctionIdx: roomIdx,
          },
        });
        await Promise.all(
          userData.map(async (user) => {
            const userInfo = await queryRunner.manager.findOne(User, {
              where: {
                idx: user.userIdx,
              },
            });
            const jsonMessage = {
              userIdx: userInfo.idx,
              profilePath: userInfo.profilePath,
              nickname: userInfo.nickname,
            };
            await redis.sadd(userkey, JSON.stringify(jsonMessage));
            userInfoList.push(JSON.stringify(jsonMessage));
            return user;
          }),
        );
      }
      result.list = conversationList;
      result.userInfo = userInfoList;
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async auctionAlertSet(
    auctionIdx: number,
    userIdx: number,
    action: string,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `auction-alert-list-${auctionIdx}`;
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      if (action === chat.ON) {
        const data = AuctionAlert.from(auctionIdx, userIdx);
        await queryRunner.manager.save(data);
        await redis.sadd(key, userIdx);
      } else if (action === chat.OFF) {
        await queryRunner.manager.delete(AuctionAlert, {
          userIdx: userIdx,
          auctionIdx: auctionIdx,
        });
        // 현재 Set 키에 저장된 모든 멤버들 조회
        const alertList = await redis.smembers(key);
        // dto.oppositeIdx와 일치하는 멤버 제거
        const updatedMembers = alertList.filter(
          (member) => member !== userIdx.toString(),
        );
        // Set 키에 업데이트된 멤버들을 다시 저장
        await redis.del(key);
        if (updatedMembers.length > 0) {
          await redis.sadd(key, updatedMembers);
        }
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  async auctionParticipation(
    auctionIdx: number,
    userIdx: number,
    user: User,
  ): Promise<void> {
    const redis = this.redisService.getClient();
    const key = `auction-user-list-${auctionIdx}`;
    const queryRunner = this.dataSource.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();

      const data = AuctionUser.from(auctionIdx, userIdx);
      await queryRunner.manager.save(data);
      const jsonMessage = {
        userIdx: userIdx,
        profilePath: null,
        nickname: null,
      };
      await redis.sadd(key, JSON.stringify(jsonMessage));

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
