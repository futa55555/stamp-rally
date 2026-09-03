import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthTokenService } from '../auth-token/auth-token.service.js';
import { SessionRepository } from './session.repository.js';

export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly authTokenService: AuthTokenService,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async createSession(userId: string): Promise<SessionTokens> {
    const refreshToken = this.authTokenService.generateRefreshToken();
    const refreshTokenHash =
      this.authTokenService.hashRefreshToken(refreshToken);
    const refreshTokenExpiresAt =
      this.authTokenService.getRefreshTokenExpiresAt();

    const session = await this.sessionRepository.create(
      userId,
      refreshTokenHash,
      refreshTokenExpiresAt,
    );

    const accessToken = await this.authTokenService.signAccessToken(
      userId,
      session.id,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
    };
  }

  async refreshSession(refreshToken: string): Promise<SessionTokens> {
    const now = new Date();
    const currentRefreshTokenHash =
      this.authTokenService.hashRefreshToken(refreshToken);

    const session = await this.sessionRepository.findActiveByRefreshTokenHash(
      currentRefreshTokenHash,
      now,
    );

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const nextRefreshToken = this.authTokenService.generateRefreshToken();
    const nextRefreshTokenHash =
      this.authTokenService.hashRefreshToken(nextRefreshToken);
    const nextRefreshTokenExpiresAt =
      this.authTokenService.getRefreshTokenExpiresAt(now);

    const accessToken = await this.authTokenService.signAccessToken(
      session.userId,
      session.id,
    );

    const rotated = await this.sessionRepository.rotateRefreshToken(
      session.id,
      currentRefreshTokenHash,
      nextRefreshTokenHash,
      nextRefreshTokenExpiresAt,
      now,
    );

    if (!rotated) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      refreshTokenExpiresAt: nextRefreshTokenExpiresAt,
    };
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.revoke(sessionId);
  }
}
