import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class AuctionUser extends BaseEntity {
  @ApiProperty({
    description: '경매게시글 번호',
    default: '465',
  })
  @IsNotEmpty()
  @Column()
  auctionIdx: number;

  @ApiProperty({
    description: '유저 아이디',
    default: '65',
  })
  @IsNotEmpty()
  @Column()
  userIdx: number;

  static from(auctionIdx: number, userIdx: number) {
    const auctionUser = new AuctionUser();
    auctionUser.auctionIdx = auctionIdx;
    auctionUser.userIdx = userIdx;
    return auctionUser;
  }
}
