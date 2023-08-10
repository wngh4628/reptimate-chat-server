import { Logger } from '@nestjs/common';
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
  ) {}
  private logger = new Logger('Chat Gateway');
  private rooms = new Map<string, Map<number, string>>();

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
    console.log('', message);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const score = Date.now();
      //1.대화 내역 저장
      const Data = ChatConversation.from(
        chatType.AUCTION,
        score,
        parseInt(message.room),
        message.userIdx,
        message.message,
      );
      await queryRunner.manager.save(Data);

      //2. 레디스 저장
      const jsonMessage = {
        userIdx: message.userIdx,
        roomIdx: message.room,
        message: message.message,
        action: 'send',
        datetime: getCurrentDateTimeString(),
      };
      const key = `auction-chat${message.room}`;
      const redis = this.redisService.getClient();
      await redis.zadd(key, score, JSON.stringify(jsonMessage));
      //3. 발송
      Array.from(
        (
          this.nsp.adapter.rooms.get(message.room) || new Set<string>()
        ).values(),
      );
      this.nsp.to(message.room).emit('Auction_message', jsonMessage);
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
      socketId: string;
      message: string;
      room: string;
    },
  ) {
    console.log('message', message);
    socket.join(message.room);
    this.logger.log(
      `옥션 ${message.userIdx}이(가) 방 ${message.room}에 참여하였습니다.`,
    );
    const roomName = `auction-chat-${message.room}`;
    const { userIdx, socketId } = message;

    if (this.rooms.has(roomName)) {
      const userMap = this.rooms.get(roomName);
      if (userMap) {
        userMap.set(userIdx, socketId);
      }
    } else {
      const userMap = new Map<number, string>();
      userMap.set(userIdx, socketId);
      this.rooms.set(roomName, userMap);
    }
    Array.from(
      (this.nsp.adapter.rooms.get(roomName) || new Set<string>()).values(),
    );
    console.log('this.rooms', this.rooms);
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
    console.log('auction_participate', message);
    const jsonMessage = {
      userIdx: message.userIdx,
      profilePath: message.profilePath,
      nickname: message.nickname,
    };
    Array.from(
      (this.nsp.adapter.rooms.get(message.room) || new Set<string>()).values(),
    );
    this.nsp.to(message.room).emit('auction_participate', jsonMessage);
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
