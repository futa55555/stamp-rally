import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { AuthProvider } from '../generated/prisma/enums.js';
import { AppleIdentityService } from './apple-identity/apple-identity.service.js';
import { AuthAccountRepository } from './auth-account.repository.js';
import { GoogleIdentityService } from './google-identity/google-identity.service.js';
import { SessionService, SessionTokens } from './session/session.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly authAccountRepository: AuthAccountRepository,
    private readonly sessionService: SessionService,
    private readonly googleIdentityService: GoogleIdentityService,
    private readonly appleIdentityService: AppleIdentityService,
  ) {}

  async loginWithGoogle(idToken: string): Promise<SessionTokens> {
    const identity = await this.verifyGoogleIdentity(idToken);

    return this.loginWithIdentity(
      AuthProvider.GOOGLE,
      identity.providerAccountId,
    );
  }

  async loginWithApple(
    identityToken: string,
    nonce: string,
  ): Promise<SessionTokens> {
    const identity = await this.verifyAppleIdentity(identityToken, nonce);

    return this.loginWithIdentity(
      AuthProvider.APPLE,
      identity.providerAccountId,
    );
  }

  refresh(refreshToken: string): Promise<SessionTokens> {
    return this.sessionService.refreshSession(refreshToken);
  }

  logout(sessionId: string): Promise<void> {
    return this.sessionService.revokeSession(sessionId);
  }

  private async verifyGoogleIdentity(idToken: string) {
    try {
      return await this.googleIdentityService.verifyIdToken(idToken);
    } catch {
      throw new UnauthorizedException('Invalid Google identity token');
    }
  }

  private async verifyAppleIdentity(identityToken: string, nonce: string) {
    try {
      return await this.appleIdentityService.verifyIdentityToken(
        identityToken,
        nonce,
      );
    } catch {
      throw new UnauthorizedException('Invalid Apple identity token');
    }
  }

  private async loginWithIdentity(
    provider: AuthProvider,
    providerAccountId: string,
  ): Promise<SessionTokens> {
    const user = await this.findOrCreateUser(provider, providerAccountId);

    return this.sessionService.createSession(user.id);
  }

  private async findOrCreateUser(
    provider: AuthProvider,
    providerAccountId: string,
  ) {
    const existingUser = await this.authAccountRepository.findUserByIdentity(
      provider,
      providerAccountId,
    );

    if (existingUser) {
      return existingUser;
    }

    try {
      return await this.authAccountRepository.createUserWithIdentity(
        provider,
        providerAccountId,
      );
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }

      const concurrentlyCreatedUser =
        await this.authAccountRepository.findUserByIdentity(
          provider,
          providerAccountId,
        );

      if (!concurrentlyCreatedUser) {
        throw error;
      }

      return concurrentlyCreatedUser;
    }
  }
}
