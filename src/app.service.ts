import { RedisService } from '@liaoliaots/nestjs-redis';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  constructor(
    // private readonly redisService: RedisService,
  ){

  }
  getHello(): string {

    // const banKey = `live-noChat-test`; // Q: 여기서 room대신 boardIdx를 사용하면 안되는건가?
    // const redis = this.redisService.getClient();
    // redis.sadd(banKey, 'test');

    return 'Hello World!';
  }
}
