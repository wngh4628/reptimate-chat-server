import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponseTemplate } from 'src/core/swagger/api-error-common-response';
import { SwaggerTag } from 'src/core/swagger/swagger-tags';
import HttpResponse from 'src/core/http/http-response';
import { Body, Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import { ApiOkPaginationResponseTemplate } from 'src/core/swagger/api-ok-pagination-response';
import { PageRequest } from 'src/core/page';
import { AuctionChatService } from './auction_chat.service';
import UseAuthGuards from '../auth/auth-guards/use-auth';
import AuthUser from 'src/core/decorators/auth-user.decorator';
import { User } from 'src/domains/user/entities/user.entity';
import { ChatRoomDto } from './dtos/chat-room.dto';
import { AuctionUser } from './entities/auction_user.entity';

@ApiTags(SwaggerTag.AUCTIONCHAT)
@ApiCommonErrorResponseTemplate()
@Controller('/auctionChat')
export class AuctionChatcontroller {
  constructor(private readonly chatService: AuctionChatService) {}

  @ApiOperation({
    summary: '경매 비딩 채팅 내역 조회',
    description: '경매 비딩 목록을 불러옵니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @Get('/:auctionIdx')
  async getChatData(
    @Res() res,
    @Query() pageRequest: PageRequest,
    @Param('auctionIdx') auctionIdx: number,
  ) {
    const result = await this.chatService.getChatData(pageRequest, auctionIdx);
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '경매 첫 입찰 처리',
    description: '해당 경매 첫 비딩 시, 참가자 명단에 추가가됩니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @ApiBody({ type: AuctionUser })
  // @UseAuthGuards()
  @Post('/bid')
  async auctionParticipation(
    @Res() res,
    @Body() dto: { auctionIdx: number; userIdx: number },
  ) {
    const result = await this.chatService.auctionParticipation(
      dto.auctionIdx,
      dto.userIdx,
    );
    return HttpResponse.ok(res, result);
  }

  @ApiOperation({
    summary: '경매 알람 ON/OFF',
    description:
      '해당 경매 첫 비딩 시, ON 처리 해야합니다. action은 on/off 입니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  // @UseAuthGuards()
  @Post('/:auctionIdx')
  async auctionAlertSet(
    @Res() res,
    @AuthUser() user: User,
    @Param('auctionIdx') auctionIdx: number,
    @Body() dto: { userIdx: number; action: string },
  ) {
    const result = await this.chatService.auctionAlertSet(
      auctionIdx,
      dto.userIdx,
      dto.action,
    );
    return HttpResponse.ok(res, result);
  }
}
