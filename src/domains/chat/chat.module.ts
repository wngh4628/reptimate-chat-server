import { Module } from '@nestjs/common';
import { EventsGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { Chatcontroller } from './chat.controller';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { ChatMemberRepository } from './repositories/chat-member.repository';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ChatConversationRepository } from './repositories/chat-conversation.repository';

@Module({
  imports: [
    TypeOrmExModule.forCustomRepository([
      ChatMemberRepository,
      ChatConversationRepository,
    ]),
    RedisModule.forRoot({
      readyLog: true,
      config: {
        host: 'localhost',
        port: 6379,
      },
    }),
  ],
  providers: [EventsGateway, ChatService], // DynamoDBService를 providers 배열에 추가합니다.
  controllers: [Chatcontroller],
  exports: [ChatService, TypeOrmExModule],
})
export class ChatModule {}
