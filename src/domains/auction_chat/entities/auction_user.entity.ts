import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class AuctionUser extends BaseEntity {
  @Column()
  auctionIdx: number;

  @Column()
  userIdx: number;

  static from(auctionIdx: number, userIdx: number) {
    const auctionUser = new AuctionUser();
    auctionUser.auctionIdx = auctionIdx;
    auctionUser.userIdx = userIdx;
    return auctionUser;
  }
}
