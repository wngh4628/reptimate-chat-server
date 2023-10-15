import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiCommonErrorResponseTemplate } from 'src/core/swagger/api-error-common-response';
import { SwaggerTag } from 'src/core/swagger/swagger-tags';
import HttpResponse from 'src/core/http/http-response';
import { Controller, Get, Param, Post, Res } from '@nestjs/common';
import { ApiOkPaginationResponseTemplate } from 'src/core/swagger/api-ok-pagination-response';
import { LiveChatService } from './live_chat.service';

@ApiTags(SwaggerTag.AUCTIONCHAT)
@ApiCommonErrorResponseTemplate()
@Controller('/LiveChat')
export class LiveChatcontroller {
  constructor(private readonly livechatService: LiveChatService) {}

  @ApiOperation({
    summary: '라이브 밴 유저 조회',
    description: '밴(차단) 유저들 목록을 조회합니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @Get('/ban/:roomIdx/:boardIdx/:userIdx')
  async getBanList(
    @Res() res,
    @Param('roomIdx') roomIdx: number,
    @Param('boardIdx') boardIdx: number,
    @Param('userIdx') userIdx: number,
  ) {
    const result = await this.livechatService.getBanList(
      roomIdx,
      boardIdx,
      userIdx,
    );
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '라이브 밴 유저를 해제합니다.',
    description: '밴(차단)당한 유저를 밴 해제합니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @Post('/ban/:roomIdx/:boardIdx/:userIdx/:banUserIdx')
  async banDelete(
    @Res() res,
    @Param('roomIdx') roomIdx: number,
    @Param('boardIdx') boardIdx: number,
    @Param('userIdx') userIdx: number,
    @Param('banUserIdx') banUserIdx: number,
  ) {
    const result = await this.livechatService.banDelete(
      roomIdx,
      boardIdx,
      userIdx,
      banUserIdx,
    );
    return HttpResponse.ok(res, result);
  }
  @ApiOperation({
    summary: '라이브 채팅 차단 유저 조회',
    description: '채팅 유저들 목록을 조회합니다.',
  })
  @ApiOkPaginationResponseTemplate({ type: Number })
  @Get('nochat/:roomIdx/:boardIdx/:userIdx')
  async getNoChatList(
    @Res() res,
    @Param('roomIdx') roomIdx: number,
    @Param('boardIdx') boardIdx: number,
    @Param('userIdx') userIdx: number,
  ) {
    console.log('roomIdx', roomIdx);
    console.log('boardIdx', boardIdx);
    console.log('userIdx', userIdx);
    const result = await this.livechatService.getNoChatList(
      roomIdx,
      boardIdx,
      userIdx,
    );
    return HttpResponse.ok(res, result);
  }
}
