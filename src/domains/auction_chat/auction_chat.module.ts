import { Module } from '@nestjs/common';
import { AuctionChatGateway } from './auction_chat.gateway';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { AuctionChatService } from './auction_chat.service';
import { AuctionChatcontroller } from './auction_chat.controller';

@Module({
  imports: [
    TypeOrmExModule.forCustomRepository([]),
    RedisModule.forRoot({
      readyLog: true,
      config: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
  providers: [AuctionChatGateway, AuctionChatService],
  controllers: [AuctionChatcontroller],
  exports: [AuctionChatService, TypeOrmExModule],
})
export class AuctionChaModule {}
