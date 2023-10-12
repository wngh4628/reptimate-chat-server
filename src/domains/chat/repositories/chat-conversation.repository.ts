import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { ChatConversation } from '../entities/chat-conversation.entity';

@CustomRepository(ChatConversation)
export class ChatConversationRepository extends Repository<ChatConversation> {
    async getUnreadCount(
        roomIdx:number,
        oppositeIdx: number
    ){
        const action = 'send'
        const totalCount = await this.createQueryBuilder('chatConversation')
            .where('chatConversation.userIdx = :oppositeIdx', { oppositeIdx })
            .andWhere('chatConversation.roomIdx = :roomIdx', {roomIdx})
            .andWhere('chatConversation.action = :action', {action})
            .getCount()            
        return totalCount;
          
    }
}
