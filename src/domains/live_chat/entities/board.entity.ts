import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class Board extends BaseEntity {
  @Column()
  category: string;

  @Column()
  userIdx: number;

  @Column()
  title: string;

  @Column()
  thumbnail: string;

  @Column()
  description: string;

  @Column()
  commentCnt: number;

  @Column()
  status: string;

  @Column()
  view: number;
}
