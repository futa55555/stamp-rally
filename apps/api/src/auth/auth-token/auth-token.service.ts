import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'node:crypto';

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

export type AccessTokenPayload = {
  sub: string;
  sid: string;
};

@Injectable()
export class AuthTokenService {
  private readonly refreshTokenTtlMilliseconds: number;

  constructor(
    private readonly jwtService: JwtService,
    configService: ConfigService,
  ) {
    const refreshTokenTtlDays = Number(
      configService.getOrThrow<string>('REFRESH_TOKEN_TTL_DAYS'),
    );

    if (
      !Number.isSafeInteger(refreshTokenTtlDays) ||
      refreshTokenTtlDays <= 0
    ) {
      throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive integer');
    }

    this.refreshTokenTtlMilliseconds =
      refreshTokenTtlDays * MILLISECONDS_PER_DAY;
  }

  signAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = {
      sub: userId,
      sid: sessionId,
    };

    return this.jwtService.signAsync(payload);
  }

  async verifyAccessToken(accessToken: string): Promise<AccessTokenPayload> {
    const payload =
      await this.jwtService.verifyAsync<AccessTokenPayload>(accessToken);

    if (
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0 ||
      typeof payload.sid !== 'string' ||
      payload.sid.length === 0
    ) {
      throw new Error('Invalid access token payload');
    }

    return {
      sub: payload.sub,
      sid: payload.sid,
    };
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken, 'utf8').digest('hex');
  }

  getRefreshTokenExpiresAt(now = new Date()): Date {
    return new Date(now.getTime() + this.refreshTokenTtlMilliseconds);
  }
}
