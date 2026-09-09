import {
  Controller,
  Get,
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
@Controller('trips/:tripId')
export class TripInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('invitation-links')
  create(
    @Req() req: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
  ) {
    return this.invitations.createLink(tripId, req.auth.userId);
  }

  @Get('invitation-links')
  links(
    @Req() req: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.invitations.listLinks(tripId, req.auth.userId, query);
  }

  @Get('invitations')
  list(
    @Req() req: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.invitations.listForTrip(tripId, req.auth.userId, query);
  }
}
