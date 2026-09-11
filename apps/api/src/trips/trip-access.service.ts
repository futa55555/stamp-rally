import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class TripAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async requireTrip(userId: string, tripId: string): Promise<void> {
    const member = await this.prisma.tripMember.findUnique({
      where: { tripId_userId: { tripId, userId } },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Trip not found');
  }

  async requireGenre(
    userId: string,
    genreId: string,
  ): Promise<{ tripId: string }> {
    const genre = await this.prisma.genre.findFirst({
      where: { id: genreId, trip: { members: { some: { userId } } } },
      select: { tripId: true },
    });
    if (!genre) throw new NotFoundException('Genre not found');
    return genre;
  }

  async requireStamp(
    userId: string,
    stampId: string,
  ): Promise<{ tripId: string }> {
    const stamp = await this.prisma.stamp.findFirst({
      where: {
        id: stampId,
        trip: { members: { some: { userId } } },
      },
      select: { tripId: true },
    });
    if (!stamp) throw new NotFoundException('Stamp not found');
    return { tripId: stamp.tripId };
  }

  async requirePost(
    userId: string,
    postId: string,
  ): Promise<{ tripId: string; stampId: string }> {
    const post = await this.prisma.post.findFirst({
      where: {
        id: postId,
        stamp: { trip: { members: { some: { userId } } } },
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
