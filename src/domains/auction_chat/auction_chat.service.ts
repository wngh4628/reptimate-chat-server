/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PageRequest } from 'src/core/page';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ChatConversation } from './entities/chat-conversation.entity';
import { chat, chatType } from './helpers/constants';
import { AuctionAlert } from './entities/auction_alert.entity';
import { AuctionUser } from './entities/auction_user.entity';
import { User } from '../user/entities/user.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuctionAlertRepository } from './repositories/auction-alert.repository';
import { AuctionChatGateway } from './auction_chat.gateway';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { FCMService } from 'src/utils/fcm.service';
import { FbTokenRepository } from '../user/repositories/user.fbtoken.repository';
import { BoardRepository } from '../live_chat/repositories/board.repository';
import * as moment from 'moment'; // moment 라이브러리 import
import { BoardAuctionRepository } from './repositories/board-auction.repository';

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
    private boardAuctionRepository:BoardAuctionRepository,
    private auctionAlertRepository: AuctionAlertRepository,
    private fbTokenRepository: FbTokenRepository,
    private auctionChatGateway: AuctionChatGateway,
    private fCMService: FCMService,
    private boardRepository: BoardRepository,
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
      // 3-1. 레디스에서 조회
      const userkey = `auction-user-list-${roomIdx}`;
      const userInfoList = await redis.smembers(userkey);
      // 3-2. 레디스에 없으면 rds에서 조회하고 레디스에 담아주기
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
        // userIdx와 일치하는 멤버 제거
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


  @Cron(CronExpression.EVERY_MINUTE)
  async checkSchedules() {
    //const currentTime = '2023-08-14 22:00'; // 테스트용
    const currentTime = moment().format('YYYY-MM-DD HH:mm');
    const socketGateway = this.auctionChatGateway;
    this.auctionFinishCheck(currentTime, socketGateway);
    this.auctionAlertCheck(currentTime);
  }
  //마감 전, 알람 설정되어 있으면 해당 시간에 노티피케이션 발송합니다. 예를들어 22:00에 마감 + 30분 전 알람이면 21:30분에 알람 노티피케이션을 발송합니다.
  async auctionAlertCheck(currentTime: string) {
    const boardAuctions = await this.boardAuctionRepository.findAlertTimeByTime(
      currentTime,
    );
    if (boardAuctions.length === 0) {
      console.log('No auction alert schedules to send alerts.');
      return;
    }
    for (const data of boardAuctions) {
      //게시글 정보 조회
      const boardInfo = await this.boardRepository.findOne({
        where: {
          idx: data.boardIdx,
        },
      });
      //마감 시간까지 몇 분 남았는지 구하기 위한 기능
      const endTime = new Date(data.endTime);
      const alertTime = new Date(data.alertTime);
      const leftTime = endTime.getTime() - alertTime.getTime();
      const leftMinute = leftTime / (1000 * 60);
      //알람 받을 유저 리스트 조회
      const alertList = await this.auctionAlertRepository.find({
        where: {
          auctionIdx: data.idx,
        },
      });
      //노티피케이션 FCM 발송
      for (const data of alertList) {
        const results = await this.fbTokenRepository.find({
          where: {
            userIdx: data.userIdx,
          },
        });
        for (const data of results) {
          this.fCMService.sendFCM(
            data.fbToken,
            boardInfo.title,
            `해당 경매 마감이 ${leftMinute}분 남았습니다.`,
          );
        }
      }
    }
  }

  /*
  경매 마감하는 기능
    - 매분 마감시간이 다된 경매가 있는지 확인하고, 있으면 마감 되었다는 메시지를 전송한다.
    - 전송방식: 유저가 채팅방에 있다면 (websocket으로)전송하고, 채팅방에 없지만 알람설정을 한 경우 FCM으로 전송한다
  */
  async auctionFinishCheck(
    currentTime: string,
    socketGateway: AuctionChatGateway,
  ) {

    const boardAuctions = await this.boardAuctionRepository.findEndTimeByTime(
      currentTime,
    );
    if (boardAuctions.length === 0) {
      console.log('No end auction schedules to send alerts.');
      return;
    }
    for (const data of boardAuctions) {
      //알람 on 설정한 유저들 목록 조회
      let alertList = await this.auctionAlertRepository.find({
        where: {
          auctionIdx: data.idx,
        },
      });
      // 마감시간에 해당하는 게시글 정보 조회
      const boardInfo = await this.boardRepository.findOne({
        where: {
          idx: data.boardIdx,
        },
      });

      // 레디스에서 마지막에 입찰한 유저의 정보를 불러온다
      const redis = this.redisService.getClient();
      const key = `auction-chat${data.boardIdx}`;
      const bidderList = await redis.zrevrange(key, 0, 0);
      const lastBidderInfo = JSON.parse(bidderList[0]);

      // 마지막에 입찰한 유저를 낙찰자(successful_bidder)로 저장
      data.successfulBidder = lastBidderInfo.userIdx
      // 마감 상태 end로 변경해서 저장
      data.state = 'end';
      this.boardAuctionRepository.save(data);
      const rooms = socketGateway.rooms;
      const roomName = `auction-chat-${data.idx.toString()}`;
      const userSocketsMap = rooms.get(roomName);
      if (!userSocketsMap) {
        throw new NotFoundException(HttpErrorConstants.CHATROOM_NOT_EXIST);
      }

      // 방에 들어있는 유저들 중에서, alertList에 있으면 alertList에서 삭제하고, alertList에 없으면 '경매 끝' 메시지를 보낸다
        // Q: 그럼, 알람설정을 한 사람이 방에 들어있으면 메시지를 못받는건가?
      for (const [userIdx, socket] of userSocketsMap) {
        for (const data of alertList) {
          // 알람설정을 한 유저가 채팅방에 들어있을 경우, 알람리스트에서 삭제한다
          if (data.userIdx === userIdx) {
            alertList = alertList.filter((alert) => alert.userIdx !== userIdx);
          } else {
            socket.emit('Auction_End', '경매 끝');
          }
        }
      }
      // 노티피케이션 발송 (발송대상: 알람설정 o, but 채팅방에 없는 유저)
      for (const data of alertList) {
        const results = await this.fbTokenRepository.find({
          where: {
            userIdx: data.userIdx,
          },
        });
        for (const data of results) {
          this.fCMService.sendFCM(
            data.fbToken,
            boardInfo.title,
            '해당 경매가 마감되었습니다.',
          );
        }
      }
    }
  }
}
