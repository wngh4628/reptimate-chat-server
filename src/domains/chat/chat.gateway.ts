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
import { ChatConversationRepository } from './repositories/chat-conversation.repository';
import { ChatConversation } from './entities/chat-conversation.entity';
import { chat, chatType } from './helpers/constants';
import { DataSource } from 'typeorm';
import { ChatRoom } from './entities/chat-room.entity';
import { ChatMember } from './entities/chat-member.entity';

@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: ['http://localhost:3001'],
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,
    private chatConversationRepository: ChatConversationRepository,
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
    socket.broadcast.emit('message', {
      message: `${socket.id}가 들어왔습니다.`,
    });
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log(`${socket.id} 소켓 연결 해제 ❌`);
  }

  @SubscribeMessage('message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: { userIdx: number; message: string; room: string },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const score = Date.now();
      //1.대화 내역 저장
      const Data = ChatConversation.from(
        chatType.PERSONAL,
        score,
        parseInt(message.room),
        message.userIdx,
        message.message,
      );
      await queryRunner.manager.save(Data);
      //2. 최신 대화 내역 갱신
      const entityToUpdate = await queryRunner.manager.findOne(ChatRoom, {
        where: { idx: parseInt(message.room) },
      });
      if (!entityToUpdate) {
        throw new Error(`해당 방을 찾을 수 없습니다.`);
      }
      entityToUpdate.recentMessage = message.message;
      await entityToUpdate.save();
      //3. 레디스 저장
      const jsonMessage = {
        userIdx: message.userIdx,
        roomIdx: message.room,
        message: message.message,
        action: 'send',
        datetime: getCurrentDateTimeString(),
      };
      const key = `personal-chat${message.room}`;
      const redis = this.redisService.getClient();
      await redis.zadd(key, score, JSON.stringify(jsonMessage));
      //4. 발송
      Array.from(
        (
          this.nsp.adapter.rooms.get(message.room) || new Set<string>()
        ).values(),
      );
      this.nsp.to(message.room).emit('message', jsonMessage);
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
    socket.join(message.room);
    this.logger.log(
      `Socket ${message.userIdx}이(가) 방 ${message.room}에 참여하였습니다.`,
    );
    const { room, userIdx, socketId } = message;

    if (this.rooms.has(room)) {
      const userMap = this.rooms.get(room);
      if (userMap) {
        userMap.set(userIdx, socketId);
      }
    } else {
      const userMap = new Map<number, string>();
      userMap.set(userIdx, socketId);
      this.rooms.set(room, userMap);
    }
    Array.from(
      (this.nsp.adapter.rooms.get(message.room) || new Set<string>()).values(),
    );
    console.log('this.rooms', this.rooms);
  }
  @SubscribeMessage('removeMessage')
  async removeMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      score: number;
      room: string;
    },
  ) {
    console.log(message);
    socket.join(message.room);
    //1. 마리아DB 삭제 처리
    const getMessage = await this.chatConversationRepository.findOne({
      where: {
        score: message.score,
        roomIdx: parseInt(message.room),
        userIdx: message.userIdx,
      },
    });
    if (!getMessage) {
      throw new Error(`해당 메시지를 찾을 수 없습니다.`);
    }
    getMessage.message = chat.DELETE;
    getMessage.deletedAt = new Date();
    await this.chatConversationRepository.save(getMessage);
    //2. 레디스 삭제
    const key = `personal-chat${message.room}`;
    const redisClient = this.redisService.getClient();

    const existingData = await redisClient.zrangebyscore(
      key,
      message.score,
      message.score,
    );
    if (existingData.length === 0) {
      throw new Error(`Score ${message.score} not found in ${key}.`);
    }

    const result = JSON.parse(existingData[0]);
    result.message = chat.DELETE;

    await redisClient.zremrangebyscore(key, message.score, message.score);
    await redisClient.zadd(key, message.score, JSON.stringify(result));
    //3. 삭제된 데이터 전송
    Array.from(
      (this.nsp.adapter.rooms.get(message.room) || new Set<string>()).values(),
    );
    this.nsp.to(message.room).emit('removeMessage', result);
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
function findKeyByValue(
  map: Map<number, string>,
  searchValue: string,
): number | undefined {
  for (const [key, value] of map.entries()) {
    if (value === searchValue) {
      return key;
    }
  }
  return undefined; // Return undefined if the value is not found in the map
}
