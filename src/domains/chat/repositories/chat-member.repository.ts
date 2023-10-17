import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { ChatMember } from '../entities/chat-member.entity';
import { PageRequest } from 'src/core/page';

@CustomRepository(ChatMember)
export class ChatMemberRepository extends Repository<ChatMember> {
  async findAndCountByUserIdx(
    pageRequest: PageRequest,
    userIdx: number,
  ): Promise<[ChatMember[], number]> {
    const [result, totalCount] = await this.createQueryBuilder('chatMember')
      .leftJoinAndSelect('chatMember.chatRoom', 'chatRoom')
      .where('chatMember.userIdx = :userIdx', { userIdx })
      .andWhere('chatRoom.recentMessage IS NOT NULL')
      .orderBy('chatRoom.updatedAt', pageRequest.order)
      .take(pageRequest.limit)
      .skip(pageRequest.offset)
      .getManyAndCount();
    return [result, totalCount];
  }
}
