import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { ChatMember } from '../entities/chat-member.entity';

@CustomRepository(ChatMember)
export class ChatMemberRepository extends Repository<ChatMember> {}
