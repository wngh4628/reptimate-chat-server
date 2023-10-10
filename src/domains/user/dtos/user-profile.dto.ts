import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UserProfileDto {
  @ApiProperty({
    description: '유저 인덱스',
    default: '1',
  })
  @IsNotEmpty()
  idx: number;

  @ApiProperty({
    description: '닉네임',
    default: '김수정',
  })
  @IsString()
  @MaxLength(32)
  @IsNotEmpty()
  nickname: string;

  @ApiProperty({
    description: '프로필 이미지',
    default:
      'https://reptimate.s3.amazonaws.com/profile/86-20230615211447-43bfc67e-eadc-4b7b-8f5c-1df88190e8d2-robot.jpg',
  })
  @IsString()
  @IsNotEmpty()
  profilePath: string;
}
