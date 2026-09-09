import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { InvitationTokenDto } from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('invitation-links')
export class InvitationLinksController {
  constructor(private readonly invitations: InvitationsService) {}
  @Post('resolve')
  @HttpCode(200)
  resolve(@Req() req: AuthenticatedRequest, @Body() dto: InvitationTokenDto) {
    return this.invitations.preview(dto.token, req.auth.userId);
  }
  @Get(':id')
  received(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.previewReceived(id, req.auth.userId);
  }
  @Post(':id/request')
  requestReceived(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.requestReceived(id, req.auth.userId);
  }
  @Post(':id/revoke')
  @HttpCode(200)
  revoke(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.revokeLink(id, req.auth.userId);
  }
}
