import {
  Body,
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
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationsService } from './invitations.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('trips/:tripId/invitations')
export class TripInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  create(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.invitations.create(request.auth.userId, tripId, dto);
  }

  @Get()
  list(
    @Req() request: AuthenticatedRequest,
    @Param('tripId', ParseUUIDPipe) tripId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.invitations.listForTrip(request.auth.userId, tripId, query);
  }
}
