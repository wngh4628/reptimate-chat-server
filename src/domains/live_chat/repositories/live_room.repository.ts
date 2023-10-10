import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { LiveRoom } from '../entities/live_room.entity';

@CustomRepository(LiveRoom)
export class LiveRoomRepository extends Repository<LiveRoom> {}
