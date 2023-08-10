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
  async BanDelete(
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
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-ban-${roomIdx}`;
    const redis = this.redisService.getClient();
    await redis.srem(banKey, banUserIdx.toString());
  }
  async noChatDelete(
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
    if (boardResult.userIdx !== userIdx) {
      throw new NotFoundException(HttpErrorConstants.LIVEROOM_NOT_HOST);
    }
    const banKey = `live-noChat-${roomIdx}`;
    const redis = this.redisService.getClient();
    await redis.srem(banKey, banUserIdx.toString());
  }
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
