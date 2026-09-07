import {
  Get,
  Controller,
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
import { PaginationQueryDto } from '../common/pagination.js';
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
  listReceived(
    @Req() request: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    return this.invitations.listReceived(request.auth.userId, query);
  }

  @Post(':id/accept')
  @HttpCode(200)
  accept(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.decide(request.auth.userId, id, 'ACCEPTED');
  }

  @Post(':id/decline')
  @HttpCode(200)
  decline(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.invitations.decide(request.auth.userId, id, 'DECLINED');
  }
}
