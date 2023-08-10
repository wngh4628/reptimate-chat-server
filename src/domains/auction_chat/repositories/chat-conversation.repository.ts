import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { ChatConversation } from '../entities/chat-conversation.entity';

@CustomRepository(ChatConversation)
export class ChatConversationRepository extends Repository<ChatConversation> {}
