import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
  type PaginationQueryDto,
} from '../common/pagination.js';
import { serializable } from '../database/transaction.js';
import {
  assertCanInvite,
  decideInvitation,
  InvitationNotFoundError,
} from './entities/invitation.entity.js';
import { rethrowInvitationError } from './invitation-errors.js';

const invitationInclude = {
  trip: {
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      coverImageUrl: true,
    },
  },
  invitee: { select: { id: true, name: true } },
  invitedBy: { select: { id: true, name: true } },
} satisfies Prisma.TripInvitationInclude;

type InvitationRecord = Prisma.TripInvitationGetPayload<{
  include: typeof invitationInclude;
}>;

function presentInvitation(invitation: InvitationRecord) {
  return {
    ...invitation,
    trip: {
      ...invitation.trip,
      startDate: invitation.trip.startDate.toISOString().slice(0, 10),
      endDate: invitation.trip.endDate.toISOString().slice(0, 10),
    },
  };
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createInitial(
    tx: Prisma.TransactionClient,
    tripId: string,
    inviterId: string,
    inviteeNames: string[],
  ): Promise<void> {
    try {
      const names = [...new Set(inviteeNames.map((name) => name.trim()))];
      if (names.length === 0) return;

      const invitees = await tx.user.findMany({
        where: { name: { in: names }, status: 'ACTIVE' },
        select: { id: true, name: true },
      });
      if (invitees.length !== names.length) {
        throw new InvitationNotFoundError('Invitee not found');
      }
      for (const invitee of invitees) {
        assertCanInvite(inviterId, invitee.id, false);
      }
      await tx.tripInvitation.createMany({
        data: invitees.map((invitee) => ({
          tripId,
          inviteeId: invitee.id,
          invitedById: inviterId,
        })),
      });
    } catch (error) {
      rethrowInvitationError(error);
    }
  }

  async create(tripId: string, inviterId: string, inviteeName: string) {
    return this.write(async (tx) => {
      const invitee = await tx.user.findFirst({
        where: { name: inviteeName.trim(), status: 'ACTIVE' },
        select: { id: true },
      });
      if (!invitee) throw new InvitationNotFoundError('Invitee not found');

      const member = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId: invitee.id } },
        select: { id: true },
      });
      assertCanInvite(inviterId, invitee.id, member !== null);

      const where = { tripId_inviteeId: { tripId, inviteeId: invitee.id } };
      const existing = await tx.tripInvitation.findUnique({
        where,
        include: invitationInclude,
      });
      if (existing?.status === 'PENDING') return presentInvitation(existing);

      const invitation = existing
        ? await tx.tripInvitation.update({
            where,
            data: { status: 'PENDING', invitedById: inviterId },
            include: invitationInclude,
          })
        : await tx.tripInvitation.create({
            data: { tripId, inviteeId: invitee.id, invitedById: inviterId },
            include: invitationInclude,
          });
      return presentInvitation(invitation);
    });
  }

  async listForTrip(tripId: string, query: PaginationQueryDto) {
    return this.list({ tripId }, query);
  }

  async listReceived(inviteeId: string, query: PaginationQueryDto) {
    return this.list({ inviteeId, status: 'PENDING' }, query);
  }

  async decide(
    invitationId: string,
    inviteeId: string,
    decision: 'ACCEPTED' | 'DECLINED',
  ) {
    return this.write(async (tx) => {
      const invitation = await tx.tripInvitation.findFirst({
        where: { id: invitationId, inviteeId },
        include: invitationInclude,
      });
      if (!invitation)
        throw new InvitationNotFoundError('Invitation not found');

      const status = decideInvitation(invitation.status, decision);
      if (invitation.status === status) return presentInvitation(invitation);

      if (status === 'ACCEPTED') {
        await tx.tripMember.upsert({
          where: {
            tripId_userId: { tripId: invitation.tripId, userId: inviteeId },
          },
          create: { tripId: invitation.tripId, userId: inviteeId },
          update: {},
        });
      }
      const updated = await tx.tripInvitation.update({
        where: { id: invitationId },
        data: { status },
        include: invitationInclude,
      });
      return presentInvitation(updated);
    });
  }

  private async list(
    where: Prisma.TripInvitationWhereInput,
    query: PaginationQueryDto,
  ) {
    const rows = await this.prisma.tripInvitation.findMany({
      where: { ...where, ...paginationWhere(query, 'desc') },
      include: invitationInclude,
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    const page = paginate(rows, query.limit);
    return { ...page, items: page.items.map(presentInvitation) };
  }

  private async write<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await serializable(this.prisma, work);
      } catch (error) {
        // Concurrent first-time invites can race on the unique recipient key.
        // Reread in a fresh transaction so both callers receive the same invite.
        if (
          attempt >= 4 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        ) {
          throw error;
        }
      }
    }
  }
}
