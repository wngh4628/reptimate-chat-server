import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class ChatRoom extends BaseEntity {
  @Column()
  recentMessage: string;
}
