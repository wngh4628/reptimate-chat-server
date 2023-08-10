import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class AuctionAlert extends BaseEntity {
  @Column()
  auctionIdx: number;

  @Column()
  userIdx: number;

  static from(auctionIdx: number, userIdx: number) {
    const auctionAlert = new AuctionAlert();
    auctionAlert.auctionIdx = auctionIdx;
    auctionAlert.userIdx = userIdx;
    return auctionAlert;
  }
}
