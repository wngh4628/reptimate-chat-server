/* eslint-disable @typescript-eslint/no-empty-function */
import { Injectable, NotFoundException } from '@nestjs/common';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { BoardRepository } from './repositories/board.repository';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { UserRepository } from '../user/repositories/user.repository';
import { UserProfileDto } from '../user/dtos/user-profile.dto';

@Injectable()
export class LiveChatService {
  constructor(
    private readonly redisService: RedisService,
    private boardRepository: BoardRepository,
    private userRepository: UserRepository,
  ) {}

  // 라이브방송 입장밴을 당한 유저들의 목록을 응답한다
  async getBanList(
    roomIdx: number,
    boardIdx: number,
    userIdx: number,
  ): Promise<UserProfileDto[]> {
    const boardResult = await this.boardRepository.findOne({
      where: {
        idx: boardIdx,
      },
    });
    // 해당 라이브방송의 호스트인지 확인한다
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-ban-${roomIdx}`;
    const redis = this.redisService.getClient();
    const setMembers = await redis.smembers(banKey);
    const result: UserProfileDto[] = [];
    for (const value of setMembers) {
      const userInfo = await this.userRepository.findOne({
        where: {
          idx: parseInt(value),
        },
      });
      const userDto = new UserProfileDto();
      userDto.idx = userInfo.idx;
      userDto.nickname = userInfo.nickname;
      userDto.profilePath = userInfo.profilePath;
      result.push(userDto);
    }
    return result;
  }
  // 유저의 라이브방송 입장밴을 해제한다
  async banDelete(
    roomIdx: number,
    boardIdx: number,
    userIdx: number,
    banUserIdx: number,
  ): Promise<void> {
    const boardResult = await this.boardRepository.findOne({
      where: {
        idx: boardIdx,
      },
    });

    // 해당 라이브방송의 호스트인지 확인한다
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-ban-${roomIdx}`;
    const redis = this.redisService.getClient();
    await redis.srem(banKey, banUserIdx.toString());
  }
  // 유저의 라이브방송 채팅밴을 해제한다
  async noChatDelete(
    roomIdx: number, // Q: roomIdx는 왜 받는거지? boardIdx랑 값이 다른가?
    boardIdx: number,
    userIdx: number,
    banUserIdx: number,
  ): Promise<void> {
    const boardResult = await this.boardRepository.findOne({
      where: {
        idx: boardIdx,
      },
    });
    // 해당 라이브방송의 호스트인지 확인한다
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-noChat-${roomIdx}`; // Q: 여기서 roomIdx대신 boardIdx를 사용하면 안되는건가?
    const redis = this.redisService.getClient();
    await redis.srem(banKey, banUserIdx.toString());
  }

  // 채팅밴을 당한 유저들의 목록을 불러온다
  async getNoChatList(
    roomIdx: number,
    boardIdx: number,
    userIdx: number,
  ): Promise<UserProfileDto[]> {
    const boardResult = await this.boardRepository.findOne({
      where: {
        idx: boardIdx,
      },
    });
    // 해당 라이브방송의 호스트인지 확인한다
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-noChat-${roomIdx}`;
    const redis = this.redisService.getClient();
    const setMembers = await redis.smembers(banKey);
    const result: UserProfileDto[] = [];
    for (const value of setMembers) {
      const userInfo = await this.userRepository.findOne({
        where: {
          idx: parseInt(value),
        },
      });
      const userDto = new UserProfileDto();
      userDto.idx = userInfo.idx;
      userDto.nickname = userInfo.nickname;
      userDto.profilePath = userInfo.profilePath;
      result.push(userDto);
    }
    return result;
  }
}
