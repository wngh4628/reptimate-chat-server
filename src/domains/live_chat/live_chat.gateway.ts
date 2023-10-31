import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
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
import { BoardRepository } from './repositories/board.repository';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';

@WebSocketGateway({
  namespace: 'LiveChat',
  cors: {
    origin: '*', // 모든 origin을 허용
    methods: ['GET', 'POST'], // 요청 허용 메서드
    allowedHeaders: ['Authorization'], // 요청 허용 헤더
    credentials: true, // 자격 증명(인증) 정보 허용
  },
})
export class LiveChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly redisService: RedisService,
    private boardRepository: BoardRepository,
  ) {}
  private logger = new Logger('Chat Gateway');
  private rooms = new Map<string, Map<number, Socket>>();

  @WebSocketServer() nsp: Namespace;
  afterInit() {
    this.nsp.adapter.on('create-room', (room) => {
      this.logger.log(`"Room:${room}"이 생성되었습니다.`);
    });

    this.nsp.adapter.on('join-live', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에 참여하였습니다.`);
    });

    this.nsp.adapter.on('leave-room', (room, id) => {
      this.logger.log(`"Socket:${id}"이 "Room:${room}"에서 나갔습니다.`);
    });

    this.nsp.adapter.on('delete-room', (roomName) => {
      this.logger.log(`"Room:${roomName}"이 삭제되었습니다.`);
    });

    this.nsp.adapter.on('message', (roomName) => {
      console.log();
    });

    this.logger.log('웹소켓 서버 초기화 ✅');
  }

  handleConnection(@ConnectedSocket() socket: Socket) {
    this.logger.log(`${socket.id} 소켓 연결`);
  }

  handleDisconnect(@ConnectedSocket() socket: Socket) {
    this.logger.log(`${socket.id} 소켓 연결 해제 ❌`);
  }
  //메세지 전송
  @SubscribeMessage('live_message')
  async handleMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() message: { userIdx: number; message: string; room: string },
  ) {
    const { userIdx, room } = message;
    if (message.message.length > 100) {
      throw new BadRequestException(HttpErrorConstants.LIVEROOM_TOO_LONG);
    }
    const noChatKey = `live-noChat-${room}`;
    const key = `live-chat-${room}`;
    const redis = this.redisService.getClient();
    const isNoChat = await redis.sismember(noChatKey, userIdx.toString());
    if (isNoChat) {
      socket.emit('no_chat', 'no chat');
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NO_CHAT);
    }
    const score = Date.now();
    //1. 레디스 저장
    const jsonMessage = {
      userIdx: userIdx,
      roomIdx: room,
      message: message.message,
      datetime: getCurrentDateTimeString(),
    };
    await redis.zadd(key, score, JSON.stringify(jsonMessage));
    //2. 발송
    this.nsp.to(message.room).emit('live_message', jsonMessage);
  }
  @SubscribeMessage('join-live')
  async handleJoinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      socketId: string;
      message: string;
      profilePath: string;
      nickname: string;
      room: string;
    },
  ) {
    const { userIdx, socketId, room, nickname, profilePath } = message;
    socket.join(room);
    const roomName = `live-chat-${room}`;
    const key = `live-user-list-${room}`;
    const banKey = `live-ban-${room}`;
    const redis = this.redisService.getClient();
    const isBanned = await redis.sismember(banKey, userIdx.toString());
    // 입장시 밴당한 유저라면, 밴당한 유저라고 응답 
    if (isBanned) {
      socket.emit('ban-notification', {
        message: HttpErrorConstants.LIVEROOM_BAN,
      });
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_BAN);
    }
    //방이 처음 만들어저면 새로 만들고 추가, 기존에 존재하면 해당 유저만 추가
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
    //방 참여자 소켓 정보
    const participants = await Array.from(
      (this.nsp.adapter.rooms.get(room) || new Set<string>()).values(),
    );
    //참여자 정보 레디스에 추가하기
    const jsonMessage = {
      userIdx: userIdx,
      profilePath: profilePath,
      nickname: nickname,
    };
    await redis.sadd(key, JSON.stringify(jsonMessage));


    const userList = await redis.smembers(key);
    // '방금 참가한 유저'에게는 해당 라이브에 참가하고 있는 모든 유저의 목록을 전달하고, 기존에 있던 유저들에게는 '방금 참가한 유저'의 정보만 전달한다
    participants.forEach((participantSocketId) => {
      if (socketId == participantSocketId) {
        this.nsp.to(room).emit('live_participate', userList);
        // Q: 위가 아니라, 다음과 같이 해야하는거 아닌가? -> socket.emit('live_participate', userList);
        
      } else {
        this.nsp.to(room).emit('live_participate', jsonMessage);
        // Q: 위가 아니라, 다음과 같이 해야하는거 아닌가? -> this.nsp.to(room).except(socketId).emit('live_participate', jsonMessage);
      }
    });
  }

  @SubscribeMessage('leave-room')
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody()
    message: {
      userIdx: number;
      roomIdx: string;
    },
  ) {
    const { userIdx, roomIdx } = message;
    const redis = this.redisService.getClient();
    await userOut(roomIdx, userIdx, redis, this.rooms); // 레디스 + 서버메모리에 있는 라이브 유저목록에서 유저를 삭제한다 
    const jsonMessage = {
      userIdx: userIdx,
    };
    this.nsp.to(roomIdx).emit('leave-user', jsonMessage);
  }
  // 라이브 방송에서 강제 퇴장 시키는 기능1: 유저 목록에서 삭제하고 차단 목록에 추가합니다.
  @SubscribeMessage('user_ban')
  async userBan(
    @MessageBody()
    message: {
      userIdx: number;
      banUserIdx: number;
      boardIdx: string;
      room: string; // Q: room은 왜 받는거지? boardIdx랑 값이 다른가?
    },
  ) {
    const { userIdx, boardIdx, banUserIdx, room } = message;
    const result = await this.boardRepository.findOne({
      where: {
        idx: parseInt(boardIdx),
      },
    });
    // 해당 라이브방송의 호스트인지 확인한다
    if (result.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-ban-${room}`; // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
    const redis = this.redisService.getClient();
    await redis.sadd(banKey, banUserIdx);

    const jsonMessage = {
      userIdx: banUserIdx,
    };
    this.nsp.to(room).emit('ban-user', jsonMessage); // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
  }
  // 라이브 방송에서 강제 퇴장 시키는 기능2: 유저 목록에서 삭제하고 차단 목록에 추가합니다.
  @SubscribeMessage('noChat')
  async noChat(
    @MessageBody()
    message: {
      userIdx: number;
      banUserIdx: number;
      boardIdx: string;
      room: string; // Q: room은 왜 받는거지? boardIdx랑 값이 다른가?
    },
  ) {
    
    const { userIdx, boardIdx, banUserIdx, room } = message;

    // console.log(`----------------------------------noChat요청 로그 시작----------------------------------`)
    // console.log(`userIdx: ${userIdx}`)
    // console.log(`boardIdx: ${boardIdx}`)
    // console.log(`banUserIdx: ${banUserIdx}`)
    // console.log(`room: ${room}`)

    const result = await this.boardRepository.findOne({
      where: {
        idx: parseInt(boardIdx),
      },
    });

    // console.log(`result.userIdx: ${result.userIdx}`)

    // console.log(`----------------------------------noChat요청 로그 끝----------------------------------`)
  
    // 해당 라이브방송의 호스트인지 확인한다
    if (result.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }

    const banKey = `live-noChat-test`; // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
    const redis = this.redisService.getClient();
    redis.sadd(banKey, 'test');

    // const banKey = `live-noChat-${room}`; // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
    // const redis = this.redisService.getClient();
    // await redis.sadd(banKey, banUserIdx);

    const roomName = `live-chat-${room}`; // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
    const userSocketsMap = this.rooms.get(roomName);
    if (!userSocketsMap) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_EXIST);
    }
    const userSocket = userSocketsMap.get(banUserIdx);
    if (userSocket) {
      userSocket.emit('no_chat', 'no chat');
    }
  }
  @SubscribeMessage('noChatDelete')
  async noChatDelete(
    @MessageBody()
    message: {
      userIdx: number;
      banUserIdx: number;
      boardIdx: string;
      room: string;
    },
  ) {
    const { userIdx, boardIdx, banUserIdx, room } = message;
    const result = await this.boardRepository.findOne({
      where: {
        idx: parseInt(boardIdx),
      },
    });
    if (result.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const noChatKey = `live-noChat-${room}`;
    const redis = this.redisService.getClient();
    await redis.srem(noChatKey, banUserIdx.toString());
    const roomName = `live-chat-${room}`;
    const userSocketsMap = this.rooms.get(roomName);
    if (!userSocketsMap) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_EXIST);
    }
    const userSocket = userSocketsMap.get(banUserIdx);
    if (userSocket) {
      const jsonMessage = {
        userIdx: banUserIdx,
      };
      userSocket.emit('no_chat_delete', jsonMessage);
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

async function userOut(roomIdx: string, userIdx: number, redis, rooms) {

  const roomName = `live-chat-${roomIdx}`;
  const key = `live-user-list-${roomIdx}`;

  // 서버 메모리에 있는 라이브 유저목록에서 유저삭제 (삭제한 이후에 해당 라이브에 유저가 없으면 라이브까지 삭제)
  if (rooms.has(roomName)) {
    const usersInRoom = rooms.get(roomName);
    if (usersInRoom.has(userIdx)) {
      usersInRoom.delete(userIdx);
      if (usersInRoom.size === 0) {
        rooms.delete(roomName);
      }
    }
  }
  // 레디스에 있는 라이브 유저목록에서 유저삭제
  const setValues = await redis.smembers(key);
  for (const value of setValues) {
    const parsedValue = JSON.parse(value);
    if (parsedValue.userIdx === userIdx) {
      // 조건에 맞는 값을 삭제
      await redis.srem(key, value);
    }
  }
}
