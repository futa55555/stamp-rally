import { Injectable } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import type { PaginationQueryDto } from '../common/pagination.js';
import type { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { InvitationRepository } from './invitation.repository.js';
import { rethrowInvitationError } from './invitation-errors.js';

@Injectable()
export class InvitationsService {
  constructor(
    private readonly invitations: InvitationRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, tripId: string, dto: CreateInvitationDto) {
    await this.access.requireTrip(userId, tripId);
    try {
      return await this.invitations.create(tripId, userId, dto.inviteeName);
    } catch (error) {
      rethrowInvitationError(error);
    }
  }

  async listForTrip(userId: string, tripId: string, query: PaginationQueryDto) {
    await this.access.requireTrip(userId, tripId);
    return this.invitations.listForTrip(tripId, query);
  }

  async listReceived(userId: string, query: PaginationQueryDto) {
    return this.invitations.listReceived(userId, query);
  }

  async decide(
    userId: string,
    invitationId: string,
    decision: 'ACCEPTED' | 'DECLINED',
  ) {
    try {
      return await this.invitations.decide(invitationId, userId, decision);
    } catch (error) {
      rethrowInvitationError(error);
    }
  }
}
