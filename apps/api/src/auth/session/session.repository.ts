import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: string, refreshTokenHash: string, expiresAt: Date) {
    return this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash,
        expiresAt,
      },
    });
  }

  findActiveByRefreshTokenHash(refreshTokenHash: string, now = new Date()) {
    return this.prisma.session.findFirst({
      where: {
        refreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
    });
  }

  async rotateRefreshToken(
    sessionId: string,
    currentRefreshTokenHash: string,
    nextRefreshTokenHash: string,
    nextExpiresAt: Date,
    now = new Date(),
  ): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        refreshTokenHash: currentRefreshTokenHash,
        revokedAt: null,
        expiresAt: {
          gt: now,
        },
      },
      data: {
        refreshTokenHash: nextRefreshTokenHash,
        expiresAt: nextExpiresAt,
      },
    });

    return result.count === 1;
  }

  async revoke(sessionId: string, revokedAt = new Date()): Promise<boolean> {
    const result = await this.prisma.session.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
      },
      data: {
        revokedAt,
      },
    });

    return result.count === 1;
  }
}
