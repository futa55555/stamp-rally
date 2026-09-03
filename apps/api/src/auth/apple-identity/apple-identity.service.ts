import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { JWTVerifyOptions, JWTVerifyResult } from 'jose';

const APPLE_ISSUER = 'https://appleid.apple.com';

export const APPLE_ID_TOKEN_VERIFIER = Symbol('APPLE_ID_TOKEN_VERIFIER');

export type AppleIdTokenVerifier = (
  identityToken: string,
  options: JWTVerifyOptions,
) => Promise<JWTVerifyResult>;

export type VerifiedAppleIdentity = {
  providerAccountId: string;
};

@Injectable()
export class AppleIdentityService {
  private readonly clientId: string;

  constructor(
    configService: ConfigService,
    @Inject(APPLE_ID_TOKEN_VERIFIER)
    private readonly verifyAppleIdToken: AppleIdTokenVerifier,
  ) {
    const clientId = configService
      .getOrThrow<string>('APPLE_OAUTH_CLIENT_ID')
      .trim();

    if (!clientId) {
      throw new Error('APPLE_OAUTH_CLIENT_ID must not be empty');
    }

    this.clientId = clientId;
  }

  async verifyIdentityToken(
    identityToken: string,
    expectedNonce: string,
  ): Promise<VerifiedAppleIdentity> {
    if (!expectedNonce) {
      throw new Error('Apple nonce must not be empty');
    }

    const { payload } = await this.verifyAppleIdToken(identityToken, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: this.clientId,
      requiredClaims: ['sub', 'exp', 'nonce'],
    });

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new Error('Invalid Apple identity token payload');
    }

    if (payload.nonce !== expectedNonce) {
      throw new Error('Invalid Apple identity token nonce');
    }

    return {
      providerAccountId: payload.sub,
    };
  }
}
