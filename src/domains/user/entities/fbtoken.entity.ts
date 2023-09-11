import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';

@Entity()
export class fbToken extends BaseEntity {
  @Column()
  userIdx: number;

  @Column()
  platform: string;

  @Column()
  fbToken: string;
}
