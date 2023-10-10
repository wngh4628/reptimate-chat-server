import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class LiveRoom extends BaseEntity {
  @Column()
  boardIdx: number;

  @Column()
  buyPrice: number;

  @Column()
  startPrice: number;

  @Column()
  unit: number;

  @Column()
  startTime: Date;

  @Column()
  endTime: Date;

  @Column()
  extensionRule: string;

  @Column()
  gender: string;

  @Column()
  size: string;

  @Column()
  variety: string;

  @Column()
  pattern: string;

  @Column()
  state: string;

  @Column()
  streamKey: string;
}
