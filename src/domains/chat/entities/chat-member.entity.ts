import BaseEntity from 'src/core/entity/base.entity';
import { Column, Entity, JoinColumn, OneToOne } from 'typeorm';
import { ChatRoom } from './chat-room.entity';
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

  @OneToOne(() => ChatRoom)
  @JoinColumn({ name: 'chat_room_idx', referencedColumnName: 'idx' }) // idx와 postIdx를 일치시킴
  chatRoom: ChatRoom;

  static From(chatRoomIdx: number, userIdx: number, oppositeIdx: number) {
    const chatMember = new ChatMember();
    chatMember.chatRoomIdx = chatRoomIdx;
    chatMember.userIdx = userIdx;
    chatMember.oppositeIdx = oppositeIdx;
    return chatMember;
  }

  UserInfo: { idx: number; nickname: string; profilePath: string };

  unreadCount: number;
}
