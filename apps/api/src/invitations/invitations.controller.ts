import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
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
import {
  InvitationDecisionDto,
  InvitationQueryDto,
  InvitationTokenDto,
} from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest, @Query() query: InvitationQueryDto) {
    return this.invitations.listReceived(req.auth.userId, query);
  }

  @Post()
  request(@Req() req: AuthenticatedRequest, @Body() dto: InvitationTokenDto) {
    return this.invitations.request(dto.token, req.auth.userId);
  }

  @Get(':id')
  detail(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.detail(id, req.auth.userId);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  confirm(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitationDecisionDto,
  ) {
    return this.invitations.decide(
      id,
      req.auth.userId,
      'confirm',
      dto.generation,
    );
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitationDecisionDto,
  ) {
    return this.invitations.decide(
      id,
      req.auth.userId,
      'decline',
      dto.generation,
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InvitationDecisionDto,
  ) {
    return this.invitations.decide(
      id,
      req.auth.userId,
      'cancel',
      dto.generation,
    );
  }
}
