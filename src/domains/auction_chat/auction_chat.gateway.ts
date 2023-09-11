import { Logger, NotFoundException } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { ChatConversation } from './entities/chat-conversation.entity';
import { chatType } from './helpers/constants';
import { DataSource } from 'typeorm';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { AuctionAlertRepository } from './repositories/auction-alert.repository';
import { FbTokenRepository } from '../user/repositories/user.fbtoken.repository';
import { FCMService } from 'src/utils/fcm.service';
import { BoardAuction } from './entities/board-auction.entity';
import { ScheduleRepository } from './repositories/schedule.repository';
import * as moment from 'moment'; // moment 라이브러리 import

@WebSocketGateway({
  namespace: 'AuctionChat',
  cors: {
    origin: ['http://localhost:3001'],
  },
})
export class AuctionChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,
    private dataSource: DataSource,
    private auctionAlertRepository: AuctionAlertRepository,
    private fbTokenRepository: FbTokenRepository,
    private fCMService: FCMService,
    private scheduleRepository: ScheduleRepository,
  ) {}
  private logger = new Logger('Chat Gateway');
  public rooms = new Map<string, Map<number, Socket>>();

  @WebSocketServer() nsp: Namespace;
  afterInit() {
    this.nsp.adapter.on('create-room', (room) => {
      this.logger.log(`"Room:${room}"이 생성되었습니다.`);
    });

    this.nsp.adapter.on('join-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에 참여하였습니다.`);
    });

    this.nsp.adapter.on('leave-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에서 나갔습니다.`);
      // const userIdx = findKeyByValue(this.rooms.get(room), id);
      // this.rooms.get(room).delete(userIdx);
    });

    this.nsp.adapter.on('delete-room', (roomName) => {
      this.logger.log(`"Room:${roomName}"이 삭제되었습니다.`);
    });

    this.nsp.adapter.on('message', (roomName) => {
      console.log(roomName);
    });

    this.logger.log('웹소켓 서버 초기화 ✅');
  }

  handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log(`${socket.id} 소켓 연결`);
    // socket.data.userIdx = userIdx;
    // socket.broadcast.emit('message', {
    //   message: `${socket.id}가 들어왔습니다.`,
    // });
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log(`${socket.id} 소켓 연결 해제 ❌`);
  }

  @SubscribeMessage('Auction_message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: { userIdx: number; message: string; room: string },
  ) {
    const { userIdx, room } = message;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const redis = this.redisService.getClient();
      const currentTime = moment().format('YYYY-MM-DD HH:mm');
      //1.옥션 정보 조회
      const auctionInfo = await this.getAuctionInfo(room);

      //2.끝난 경매 확인
      if (auctionInfo.state === 'end') {
        throw new NotFoundException(HttpErrorConstants.AUCTION_END);
      }
      //3. 현재 입찰가 보다 높은지 확인
      if (auctionInfo.currentPrice >= parseInt(message.message)) {
        throw new NotFoundException(HttpErrorConstants.AUCTION_PRICE_ROW);
      }

      //4.연장 룰 확인. 적용되면 시간 추가
      if (
        auctionInfo.extensionRule === 1 &&
        moment(currentTime).isAfter(auctionInfo.extensionTime)
      ) {
        auctionInfo.endTime = moment(auctionInfo.endTime)
          .add(1, 'minute')
          .format('YYYY-MM-DD HH:mm');
        await queryRunner.manager.save(auctionInfo);
        await redis.set(`acutionInfo-${room}`, JSON.stringify(auctionInfo));
      }

      //5. 옥션 테이블에 현재 입찰가격 갱신
      auctionInfo.currentPrice = parseInt(message.message);
      await queryRunner.manager.save(auctionInfo);
      await redis.set(`acutionInfo-${room}`, JSON.stringify(auctionInfo));
      const score = Date.now();

      //6.대화 내역 저장
      const Data = ChatConversation.from(
        chatType.AUCTION,
        score,
        parseInt(room),
        userIdx,
        message.message,
      );
      await queryRunner.manager.save(Data);

      //7. 레디스 저장
      const jsonMessage = {
        userIdx: userIdx,
        roomIdx: room,
        message: message.message,
        action: 'send',
        datetime: getCurrentDateTimeString(),
      };
      const key = `auction-chat${room}`;
      await redis.zadd(key, score, JSON.stringify(jsonMessage));

      //8. 알람(노티피케이션) 받을 사람 리스트 조회
      let alertList = await this.auctionAlertRepository.find({
        where: {
          auctionIdx: parseInt(room),
        },
      });

      //9. 채팅방(경매방)에 있는 유저들에게 발송
      const roomName = `auction-chat-${room}`;
      const userSocketsMap = this.rooms.get(roomName);
      if (!userSocketsMap) {
        throw new NotFoundException(HttpErrorConstants.CHATROOM_NOT_EXIST);
      }
      for (const [userIdx, socket] of userSocketsMap) {
        for (const data of alertList) {
          if (data.userIdx === userIdx) {
            alertList = alertList.filter((alert) => alert.userIdx !== userIdx);
          } else {
            socket.emit('Auction_message', Data);
          }
        }
      }

      //10. 채팅방(경매방)에 있는 유저를 제외한 나머지 노티피케이션 발송
      for (const data of alertList) {
        const results = await this.fbTokenRepository.find({
          where: {
            userIdx: data.userIdx,
          },
        });
        for (const data of results) {
          this.fCMService.sendFCM(
            data.fbToken,
            '타이틀',
            `해당 경매가가 ${message.message}로 갱신되었습니다.`,
          );
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
  @SubscribeMessage('join-room')
  handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      message: string;
      room: string;
    },
  ) {
    socket.join(message.room);
    this.logger.log(
      `옥션 ${message.userIdx}이(가) 방 ${message.room}에 참여하였습니다.`,
    );
    const roomName = `auction-chat-${message.room}`;
    const { userIdx } = message;

    if (this.rooms.has(roomName)) {
      const userMap = this.rooms.get(roomName);
      if (userMap) {
        userMap.set(userIdx, socket);
      }
    } else {
      const userMap = new Map<number, Socket>();
      userMap.set(userIdx, socket);
      this.rooms.set(roomName, userMap);
    }
  }
  @SubscribeMessage('auction_participate')
  async joinsend(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      profilePath: string;
      nickname: string;
      room: string;
    },
  ) {
    const jsonMessage = {
      userIdx: message.userIdx,
      profilePath: message.profilePath,
      nickname: message.nickname,
    };
    this.nsp.to(message.room).emit('auction_participate', jsonMessage);
  }
  async getAuctionInfo(room: string): Promise<BoardAuction> {
    //1.옥션 정보 조회
    const redis = this.redisService.getClient();
    const auctionInfo = await redis.get(`acutionInfo-${room}`);
    if (!auctionInfo) {
      const result = await this.scheduleRepository.findOne({
        where: {
          idx: parseInt(room),
        },
      });
      const data = JSON.stringify(result);
      await redis.set(`acutionInfo-${room}`, data);
      return result;
    } else {
      const data = JSON.parse(auctionInfo);
      const result = BoardAuction.from(
        data.idx,
        data.boardIdx,
        data.buyPrice,
        data.startPrice,
        data.currentPrice,
        data.unit,
        data.endTime,
        data.extensionRule,
        data.extensionTime,
        data.gender,
        data.size,
        data.variety,
        data.pattern,
        data.state,
        data.streamKey,
        data.createdAt,
        data.updatedAt,
      );
      return result;
    }
  }
}

function getCurrentDateTimeString() {
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, '0');
  const day = String(currentDate.getDate()).padStart(2, '0');
  const hours = String(currentDate.getHours()).padStart(2, '0');
  const minutes = String(currentDate.getMinutes()).padStart(2, '0');
  const seconds = String(currentDate.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
