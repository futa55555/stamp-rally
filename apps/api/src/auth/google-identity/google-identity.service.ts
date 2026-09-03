import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

export type VerifiedGoogleIdentity = {
  providerAccountId: string;
};

@Injectable()
export class GoogleIdentityService {
  private readonly clientId: string;

  constructor(
    configService: ConfigService,
    private readonly oauthClient: OAuth2Client,
  ) {
    const clientId = configService
      .getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID')
      .trim();

    if (!clientId) {
      throw new Error('GOOGLE_OAUTH_CLIENT_ID must not be empty');
    }

    this.clientId = clientId;
  }

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
    const ticket = await this.oauthClient.verifyIdToken({
      idToken,
      audience: this.clientId,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      payload.sub.length === 0
    ) {
      throw new Error('Invalid Google ID token payload');
    }

    return {
      providerAccountId: payload.sub,
    };
  }
}
