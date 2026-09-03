import { Module } from '@nestjs/common';
import { AuthAccountRepository } from './auth-account.repository.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthTokenService } from './auth-token/auth-token.service.js';
import { SessionRepository } from './session/session.repository.js';
import { SessionService } from './session/session.service.js';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard.js';
import {
  APPLE_ID_TOKEN_VERIFIER,
  AppleIdTokenVerifier,
  AppleIdentityService,
} from './apple-identity/apple-identity.service.js';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { GoogleIdentityService } from './google-identity/google-identity.service.js';
import { OAuth2Client } from 'google-auth-library';
import { AuthService } from './auth.service.js';
import { AuthController } from './auth.controller.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const expiresIn = Number(
          configService.getOrThrow<string>('JWT_ACCESS_TTL_SECONDS'),
        );

        if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
          throw new Error('JWT_ACCESS_TTL_SECONDS must be a positive integer');
        }

        return {
          secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
          signOptions: {
            expiresIn,
          },
        };
      },
    }),
  ],
  providers: [
    {
      provide: APPLE_ID_TOKEN_VERIFIER,
      useFactory: (): AppleIdTokenVerifier => {
        const applePublicKeys = createRemoteJWKSet(
          new URL('https://appleid.apple.com/auth/keys'),
        );

        return (identityToken, options) =>
          jwtVerify(identityToken, applePublicKeys, options);
      },
    },
    {
      provide: OAuth2Client,
      useFactory: () => new OAuth2Client(),
    },
    AuthAccountRepository,
    AuthTokenService,
    SessionRepository,
    SessionService,
    JwtAuthGuard,
    AppleIdentityService,
    GoogleIdentityService,
    AuthService,
  ],
  exports: [AuthAccountRepository, JwtAuthGuard],
  controllers: [AuthController],
})
export class AuthModule {}
