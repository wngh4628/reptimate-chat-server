import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity } from 'typeorm';
@Entity()
export class ChatMember extends BaseEntity {
  @Column()
  chatRoomIdx: number;

  @Column()
  userIdx: number;

  @Column()
  oppositeIdx: number;

  @Column()
  state: string;

  @Column()
  roomOut: Date;

  static From(chatRoomIdx: number, userIdx: number, oppositeIdx: number) {
    const chatMember = new ChatMember();
    chatMember.chatRoomIdx = chatRoomIdx;
    chatMember.userIdx = userIdx;
    chatMember.oppositeIdx = oppositeIdx;
    return chatMember;
  }
}
