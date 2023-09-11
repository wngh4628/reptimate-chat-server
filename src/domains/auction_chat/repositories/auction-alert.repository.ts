import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { AuctionAlert } from '../entities/auction_alert.entity';

@CustomRepository(AuctionAlert)
export class AuctionAlertRepository extends Repository<AuctionAlert> {}
