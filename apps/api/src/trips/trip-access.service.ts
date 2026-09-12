import {
  activeCategory,
  activeStamp,
  activePost,
  memberTrip,
} from '../database/active-records.js';
import type { Prisma } from '../generated/prisma/client.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TripAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireTrip(
    userId: string,
    tripId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    return requireTripMember(tx, userId, tripId);
  }

  async requireCategory(
    userId: string,
    categoryId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ tripId: string }> {
    const category = await tx.category.findFirst({
      where: { id: categoryId, ...activeCategory, trip: memberTrip(userId) },
      select: { tripId: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async requireStamp(
    userId: string,
    stampId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ tripId: string }> {
    const stamp = await tx.stamp.findFirst({
      where: {
        id: stampId,
        ...activeStamp,
        trip: memberTrip(userId),
      },
      select: { tripId: true },
    });
    if (!stamp) throw new NotFoundException('Stamp not found');
    return { tripId: stamp.tripId };
  }

  async requirePost(
    userId: string,
    postId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<{ tripId: string; stampId: string }> {
    const post = await tx.post.findFirst({
      where: {
        id: postId,
        ...activePost,
        stamp: { ...activeStamp, trip: memberTrip(userId) },
      },
      select: {
        stampId: true,
        stamp: {
          select: { tripId: true },
        },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return {
      tripId: post.stamp.tripId,
      stampId: post.stampId,
    };
  }
}

export async function requireTripMember(
  tx: Prisma.TransactionClient,
  userId: string,
  tripId: string,
): Promise<void> {
  const member = await tx.tripMember.findUnique({
    where: { tripId_userId: { tripId, userId }, trip: { deletedAt: null } },
    select: { id: true },
  });
  if (!member) throw new NotFoundException('Trip not found');
}
