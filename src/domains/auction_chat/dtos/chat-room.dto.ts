import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';

export class ChatRoomDto {
  @ApiProperty({
    description: '방 번호',
    default: '1',
  })
  @IsNotEmpty()
  idx: number;

  @ApiProperty({
    description: '상대 유저 번호',
    default: '2',
  })
  @IsNotEmpty()
  oppositeIdx: number;
}
export class CreateRoomDto {
  @ApiProperty({
    description: '상대 유저 번호',
    default: '2',
  })
  @IsNotEmpty()
  oppositeIdx: number;
}
