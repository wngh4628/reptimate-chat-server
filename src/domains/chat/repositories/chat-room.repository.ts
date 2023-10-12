import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { ChatRoom } from '../entities/chat-room.entity';

@CustomRepository(ChatRoom)
export class ChatRoomRepository extends Repository<ChatRoom> {


}
