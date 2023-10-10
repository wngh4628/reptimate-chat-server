import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { ChatMember } from './chat-member.entity';
@Entity()
export class ChatRoom extends BaseEntity {
  @Column()
  recentMessage: string;

  @OneToOne(() => ChatMember)
  @JoinColumn({ name: 'idx', referencedColumnName: 'chatRoomIdx' }) // postIdx와 idx를 일치시킴
  chatMember: ChatMember;
}
