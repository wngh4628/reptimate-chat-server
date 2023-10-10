import { Module } from '@nestjs/common';
import { AuctionChatGateway } from './auction_chat.gateway';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuctionChatService } from './auction_chat.service';
import { AuctionChatcontroller } from './auction_chat.controller';
import { ScheduleRepository } from './repositories/schedule.repository';
import { AuctionAlertRepository } from './repositories/auction-alert.repository';
import { FbTokenRepository } from '../user/repositories/user.fbtoken.repository';
import { FCMService } from 'src/utils/fcm.service';
import { BoardRepository } from '../live_chat/repositories/board.repository';

@Module({
  imports: [
    TypeOrmExModule.forCustomRepository([
      ScheduleRepository,
      AuctionAlertRepository,
      FbTokenRepository,
      BoardRepository,
    ]),
    // RedisModule.forRoot({
    //   readyLog: true,
    //   config: {
    //     host: 'localhost',
    //     port: 6379,
    //   },
    // }),
  ],
  providers: [AuctionChatGateway, AuctionChatService, FCMService],
  controllers: [AuctionChatcontroller],
  exports: [AuctionChatService, TypeOrmExModule],
})
export class AuctionChatModule {}
