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
import { FbTokenRepository } from '../user/repositories/user.fbtoken.repository';
import { FCMService } from 'src/utils/fcm.service';
import { UserService } from '../user/user.service';


@WebSocketGateway({
  namespace: 'chat',
  cors: {
    origin: '*', // 모든 origin을 허용
    methods: ['GET', 'POST'], // 요청 허용 메서드
    allowedHeaders: ['Authorization'], // 요청 허용 헤더
    credentials: true, // 자격 증명(인증) 정보 허용
  },
})
export class EventsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,
    private chatConversationRepository: ChatConversationRepository,
    private dataSource: DataSource,
    private fbTokenRepository: FbTokenRepository,
    private fCMService: FCMService,
    private userService: UserService,
  ) {}
  private logger = new Logger('Chat Gateway');
  private rooms = new Map<string, Map<number, Socket>>();

  @WebSocketServer()
  nsp: Namespace;

  afterInit(nsp) {

    nsp.adapter.on('create-room', (room) => {
      this.logger.log(`"Room:${room}"이 생성되었습니다.`);
    });

    nsp.adapter.on('join-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에 참여하였습니다.`);
    });

    nsp.adapter.on('leave-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에서 나갔습니다.`);
      // const userIdx = findKeyByValue(this.rooms.get(room), id);
      // this.rooms.get(room).delete(userIdx);
    });

    nsp.adapter.on('delete-room', (roomName) => {
      this.logger.log(`"Room:${roomName}"이 삭제되었습니다.`);
    });

    nsp.adapter.on('message', (roomName) => {
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
    @MessageBody()
    message: {
      userIdx: number;
      oppositeIdx: number;
      message: string;
      room: string;
    },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {

      this.logger.log(
        `채팅 발신 이벤트(1) - 발신자 ID: ${message.userIdx} / 수신자 ID: ${message.oppositeIdx} / room ID: ${message.room} / 메시지: ${message.message}`,
      );

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
        score: score,
      };
      const key = `personal-chat${message.room}`;
      const redis = this.redisService.getClient();
      await redis.zadd(key, score, JSON.stringify(jsonMessage));



      //4. 발송
      this.nsp.to(message.room).emit('message', jsonMessage);

      //5. 상대방이 현재 방에 존재하는지 확인하고 노티피케이션 발송
      const socketIdsInRoom = Array.from(
        this.nsp.adapter.rooms.get(message.room) || [],
      );

      this.logger.log(
        `채팅 발신 이벤트(2) - ${message.room}번 방에 몇명이 있는가? (발신자 포함) ${socketIdsInRoom.length}`,
      );

      const otherUserIds = socketIdsInRoom.filter(
        (socketId) => socketId !== socket.id,
      );

      this.logger.log(
        `채팅 발신 이벤트(3) - ${message.room}번 방에 몇명이 있는가? (발신자 제외) ${otherUserIds.length}`,
      );

      const otherUsersExist = otherUserIds.length > 0;
      if (otherUsersExist === false) {
      
        const results = await this.fbTokenRepository.find({
          where: {
            userIdx: message.oppositeIdx,
          },
        });

        const senderInfo = await this.userService.getUserDetailInfo(
          message.userIdx,
        );
      

        for (const data of results) {

          this.logger.log(
            `채팅 발신 이벤트(4) - ${data.fbToken}에 알림을 보냈다.`,
          );

          this.fCMService.sendFCM(
            data.fbToken,
            senderInfo.nickname,
            `${message.message}`
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
  @SubscribeMessage('messageRead')
  async MessageRead(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      // oppositeIdx: number;
      score: string;
      room: string;
    },
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      //1. rds에서 채팅상태를 '안읽음 -> 읽음'으로 변경
      const returnMessage = await queryRunner.manager.findOne(
        ChatConversation,
        {
          where: { score: parseInt(message.score) },
        },
      );
      if (!returnMessage) {
        throw new Error(`해당 메시지가 없습니다.`);
      }
      returnMessage.action = 'read';
      await returnMessage.save();
      // 3. 레디스 저장
      const key = `personal-chat${message.room}`;
      const redis = this.redisService.getClient();
      // await redis.zadd(key, score, JSON.stringify(jsonMessage));
      const members = await redis.zrangebyscore(
        key,
        returnMessage.score,
        returnMessage.score,
      );
      
      if (members && members.length > 0) {
        const member = JSON.parse(members[0]); // JSON 문자열을 파싱하여 객체로 변환합니다.
        member.action = 'read'; // action을 "read"로 변경합니다.
        // 레디스에서 기존 멤버를 제거하고 수정된 멤버를 추가합니다.
        await redis.zremrangebyscore(
          key,
          returnMessage.score,
          returnMessage.score,
        );
        await redis.zadd(key, returnMessage.score, JSON.stringify(member));
      }
      //4. 발송
      this.nsp.to(message.room).emit('afterRead', members);
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
      message: string; // 클라이언트에서 해당 파라미터 전달 안한다고 하면 지우기
      room: string;
    },
  ) {
    socket.join(message.room);
    this.logger.log(
      `Socket ${message.userIdx}이(가) 방 ${message.room}에 참여하였습니다.`,
    );
    // const { room, userIdx } = message;

    // if (this.rooms.has(room)) {
    //   const userMap = this.rooms.get(room);
    //   if (userMap) {
    //     userMap.set(userIdx, socket);
    //   }
    // } else {
    //   const userMap = new Map<number, Socket>();
    //   userMap.set(userIdx, socket);
    //   this.rooms.set(room, userMap);
    // }
    // console.log('this.rooms', this.rooms);
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
    // socket.join(message.room);
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
    // Array.from(
    //   (this.nsp.adapter.rooms.get(message.room) || new Set<string>()).values(),
    // );
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
