import { Module } from '@nestjs/common';
import { AuctionChatGateway } from './auction_chat.gateway';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuctionChatService } from './auction_chat.service';
import { AuctionChatcontroller } from './auction_chat.controller';
import { AuctionAlertRepository } from './repositories/auction-alert.repository';
import { FbTokenRepository } from '../user/repositories/user.fbtoken.repository';
import { FCMService } from 'src/utils/fcm.service';
import { BoardRepository } from '../live_chat/repositories/board.repository';
import { BoardAuctionRepository } from './repositories/board-auction.repository';

@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   envFilePath: process.env.NODE_ENV === 'dev' ? 'env.dev' : 'env.prod',
    // }),
    TypeOrmExModule.forCustomRepository([
      AuctionAlertRepository,
      FbTokenRepository,
      BoardRepository,
      BoardAuctionRepository
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
