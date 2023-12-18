import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { BoardAuction } from '../entities/board-auction.entity';

@CustomRepository(BoardAuction)
export class BoardAuctionRepository extends Repository<BoardAuction> {
  async findEndTimeByTime(time: string) {
    return await this.createQueryBuilder('boardAuction')
      .where('boardAuction.endTime <= :time', { time })
      .andWhere('boardAuction.state = :state', { state: 'selling' })
      .getMany();
  }
  async findAlertTimeByTime(time: string) {
    return await this.createQueryBuilder('boardAuction')
      .where('boardAuction.alertTime = :time', { time })
      .andWhere('boardAuction.state = :state', { state: 'selling' })
      .getMany();
  }
}
