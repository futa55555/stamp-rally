import { memberPost } from '../database/active-records.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
  type PaginationQueryDto,
} from '../common/pagination.js';
import { serializable } from '../database/transaction.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string, query: PaginationQueryDto) {
    // A single snapshot keeps the page and the global badge count consistent.
    return this.prisma.$transaction(
      async (tx) => {
        const where = notificationAccess(userId);
        const rows = await tx.notification.findMany({
          where: { AND: [where, paginationWhere(query, 'desc')] },
          orderBy: paginationOrder('desc'),
          take: query.limit + 1,
        });
        const unreadCount = await tx.notification.count({
          where: { ...where, readAt: null },
        });
        return { ...paginate(rows, query.limit), unreadCount };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }

  markRead(userId: string, id: string) {
    return serializable(this.prisma, async (tx) => {
      const current = await tx.notification.findFirst({
        where: { id, ...notificationAccess(userId) },
      });
      if (!current) throw new NotFoundException('Notification not found');
      if (current.readAt) return current;
      return tx.notification.update({
        where: { id },
        data: { readAt: new Date() },
      });
    });
  }
}

// Invitation recipients can read their own links and requests before joining.
// Ordinary notifications still require membership and ready media.
function notificationAccess(userId: string) {
  return {
    recipientId: userId,
    trip: { deletedAt: null },
    OR: [
      {
        invitationId: null,
        invitationLinkId: null,
        OR: [{ postId: null }, { post: memberPost(userId) }],
        trip: { members: { some: { userId } } },
      },
      { invitationLinkId: { not: null } },
      {
        invitation: {
          OR: [
            { inviteeId: userId },
            { trip: { members: { some: { userId } } } },
          ],
        },
      },
    ],
  };
}
