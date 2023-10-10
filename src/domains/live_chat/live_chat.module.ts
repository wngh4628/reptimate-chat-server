import { Module } from '@nestjs/common';
import { LiveChatGateway } from './live_chat.gateway';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { BoardRepository } from './repositories/board.repository';
import { LiveChatcontroller } from './live_chat.controller';
import { LiveChatService } from './live_chat.service';
import { UserRepository } from '../user/repositories/user.repository';
@Module({
  imports: [
    TypeOrmExModule.forCustomRepository([BoardRepository, UserRepository]),
  ],
  providers: [LiveChatGateway, LiveChatService],
  controllers: [LiveChatcontroller],
  exports: [LiveChatService, TypeOrmExModule],
})
export class LiveChaModule {}
