import {
  rememberCategoryRemoval,
  rememberMembershipRemoval,
} from '../trip-templates/remember-exclusions.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { serializable } from '../database/transaction.js';
import { TripAccessService } from '../trips/trip-access.service.js';
import { deleteCategories, deleteStamps } from './delete-entities.js';
import { purgePosts } from './purge-posts.js';

@Injectable()
export class DeletionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
  ) {}
  async delete(
    userId: string,
    kind: 'trip' | 'category' | 'stamp',
    id: string,
  ): Promise<void> {
    await serializable(this.prisma, async (tx) => {
      const row =
        kind === 'trip'
          ? await tx.trip.findUnique({
              where: { id },
              select: { id: true, deletedAt: true },
            })
          : kind === 'category'
            ? await tx.category.findUnique({
                where: { id },
                select: { tripId: true, deletedAt: true },
              })
            : await tx.stamp.findUnique({
                where: { id },
                select: { tripId: true, deletedAt: true },
              });
      if (!row) throw new NotFoundException('Resource not found');
      const tripId = 'tripId' in row ? row.tripId : row.id;
      const member = await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
      });
      if (!member) throw new NotFoundException('Resource not found');
      if (row.deletedAt) return;
      const now = new Date();
      if (kind === 'stamp') {
        await this.access.requireStamp(userId, id, tx);
        await rememberMembershipRemoval(tx, id);
        await deleteStamps(tx, [id], now);
      } else if (kind === 'category') {
        await this.access.requireCategory(userId, id, tx);
        await rememberCategoryRemoval(tx, id);
        await deleteCategories(tx, [id], now);
      } else {
        await this.access.requireTrip(userId, id, tx);
        await purgePosts(tx, { stamp: { tripId: id } }, now);
        await tx.stamp.updateMany({
          where: { tripId: id, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.category.updateMany({
          where: { tripId: id, deletedAt: null },
          data: { deletedAt: now },
        });
        await tx.invitationLink.updateMany({
          where: { tripId: id, revokedAt: null },
          data: { revokedAt: now },
        });
        await tx.tripInvitation.updateMany({
          where: {
            tripId: id,
            status: { in: ['PENDING', 'PENDING_CONFIRMATION'] },
          },
          data: { status: 'CANCELLED', generation: { increment: 1 } },
        });
        // Detachment invokes the existing transactional cover-cleanup trigger.
        await tx.trip.update({
          where: { id },
          data: { deletedAt: now, coverAssetId: null, coverImageUrl: null },
        });
      }
    });
  }
}
