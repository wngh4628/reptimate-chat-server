import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponseTemplate } from 'src/core/swagger/api-error-common-response';
import { SwaggerTag } from 'src/core/swagger/swagger-tags';
import UseAuthGuards from '../auth/auth-guards/use-auth';
import AuthUser from 'src/core/decorators/auth-user.decorator';
import { User } from 'src/domains/user/entities/user.entity';
import HttpResponse from 'src/core/http/http-response';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOkPaginationResponseTemplate } from 'src/core/swagger/api-ok-pagination-response';
import { ChatService } from './chat.service';
import { ApiErrorResponseTemplate } from 'src/core/swagger/apt-error-response';
import { StatusCodes } from 'http-status-codes';
import { HttpErrorConstants } from 'src/core/http/http-error-objects';
import { ChatRoomDto, CreateRoomDto } from './dtos/chat-room.dto';
import { PageRequest } from 'src/core/page';

@ApiTags(SwaggerTag.PERSONALCHAT)
@ApiCommonErrorResponseTemplate()
@Controller('/chat')
export class Chatcontroller {
  constructor(private readonly chatService: ChatService) {}

  @ApiOperation({
    summary: '채팅방 생성',
    description: '채팅방을 생성합니다',
  })
  @ApiErrorResponseTemplate([
    {
      status: StatusCodes.NOT_FOUND,
      errorFormatList: [HttpErrorConstants.CANNOT_FIND_USER],
    },
  ])
  @ApiBody({ type: CreateRoomDto })
  @UseAuthGuards()
  @Post('/')
  async createBoard(
    @Res() res,
    @Body() dto: CreateRoomDto,
    @AuthUser() user: User,
  ) {
    const result = await this.chatService.createRoom(dto, user.idx);
    return HttpResponse.created(res, { body: result });
  }
  @ApiOperation({
    summary: '채팅방 인덱스 조회',
    description: '1:1 채팅방 입장 전, 인덱스 조회하는 기능입니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @UseAuthGuards()
  @Get('/room/:oppositeIdx')
  async getRoomIdx(
    @Res() res,
    @AuthUser() user: User,
    @Param('oppositeIdx') oppositeIdx: number,
  ) {
    const result = await this.chatService.findChatRoom(user.idx, oppositeIdx);
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '채팅 방 목록 조회',
    description: '유저 인덱스로 방 목록을 조회합니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @UseAuthGuards()
  @Get('list/')
  async getChatRoomList(
    @Res() res,
    @AuthUser() user: User,
    @Query() pageRequest: PageRequest,
  ) {
    const result = await this.chatService.getChatRoomList(pageRequest, user.idx);
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '채팅 내역 조회',
    description: '1:1 채팅방 첫 입장 시, 읽음 처리까지 같이 합니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @UseAuthGuards()
  @Get('/:roomIdx')
  async getChatData(
    @Res() res,
    @AuthUser() user: User,
    @Query() pageRequest: PageRequest,
    @Param('roomIdx') roomIdx: number,
  ) {
    const result = await this.chatService.getChatData(
      pageRequest,
      roomIdx,
      user.idx,
    );
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '채팅 상대방 차단 or 차단 해제',
    description: '차단된 유저는 해제, 차단 되지 않은 유조는 차단을 설정합니다.',
  })
  @ApiErrorResponseTemplate([
    {
      status: StatusCodes.NOT_FOUND,
      errorFormatList: [HttpErrorConstants.CANNOT_FIND_USER],
    },
  ])
  @ApiBody({ type: ChatRoomDto })
  @UseAuthGuards()
  @Post('/ban')
  async chatBan(@Res() res, @Body() dto: ChatRoomDto, @AuthUser() user: User) {
    const result = await this.chatService.chatBan(dto, user.idx);
    return HttpResponse.created(res, { body: result });
  }
  @ApiOperation({
    summary: '채팅방에서 나가게 됩니다.',
    description: '채팅방 나가는 기능입니다..',
  })
  @ApiErrorResponseTemplate([
    {
      status: StatusCodes.NOT_FOUND,
      errorFormatList: [HttpErrorConstants.CANNOT_FIND_USER],
    },
  ])
  @UseAuthGuards()
  @Delete('/:roomIdx')
  async chatRoomOut(
    @Res() res,
    @Param('roomIdx') roomIdx: number,
    @AuthUser() user: User,
  ) {
    const result = await this.chatService.chatRoomOut(roomIdx, user.idx);
    return HttpResponse.created(res, { body: result });
  }
}
