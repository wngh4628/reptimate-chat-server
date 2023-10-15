import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class BoardAuction extends BaseEntity {
  @Column()
  boardIdx: number;

  @Column()
  buyPrice: number;

  @Column()
  startPrice: number;

  @Column()
  currentPrice: number;

  @Column()
  unit: number;

  @Column()
  alertTime: Date;

  @Column()
  endTime: string;

  @Column()
  extensionTime: string;

  @Column()
  extensionRule: number;

  @Column({
    nullable: false,
    length: 45,
  })
  gender: string;

  @Column({
    nullable: false,
    length: 45,
  })
  size: string;

  @Column({
    nullable: false,
    length: 300,
  })
  variety: string;

  @Column({
    nullable: false,
    length: 100,
  })
  pattern: string;

  @Column({
    nullable: false,
    length: 40,
  })
  state: string;

  @Column()
  successfulBidder: string;

  @Column({
    nullable: false,
    length: 150,
  })
  streamKey: string;

  // @ManyToOne(() => User, (user) => user.schedules)
  // @JoinColumn({ name: 'user_idx' })
  // user: User;

  static from(
    idx: number,
    boardIdx: number,
    buyPrice: number,
    startPrice: number,
    currentPrice: number,
    unit: number,
    endTime: string,
    extensionRule: number,
    extensionTime: string,
    gender: string,
    size: string,
    variety: string,
    pattern: string,
    state: string,
    streamKey: string,
    createdAt: Date,
    updatedAt: Date,
  ) {
    const boardAuction = new BoardAuction();
    boardAuction.idx = idx;
    boardAuction.boardIdx = boardIdx;
    boardAuction.buyPrice = buyPrice;
    boardAuction.startPrice = startPrice;
    boardAuction.currentPrice = currentPrice;
    boardAuction.unit = unit;
    boardAuction.endTime = endTime;
    boardAuction.extensionRule = extensionRule;
    boardAuction.extensionTime = extensionTime;
    boardAuction.gender = gender;
    boardAuction.size = size;
    boardAuction.variety = variety;
    boardAuction.pattern = pattern;
    boardAuction.state = state;
    boardAuction.streamKey = streamKey;
    boardAuction.createdAt = createdAt;
    boardAuction.updatedAt = updatedAt;
    return boardAuction;
  }
}
