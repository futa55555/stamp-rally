import { Module } from '@nestjs/common';
import { AuthAccountRepository } from './auth-account.repository.js';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthTokenService } from './auth-token/auth-token.service.js';
import { SessionRepository } from './session/session.repository.js';
import { SessionService } from './session/session.service.js';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard.js';

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
    AuthAccountRepository,
    AuthTokenService,
    SessionRepository,
    SessionService,
    JwtAuthGuard,
  ],
  exports: [AuthAccountRepository, JwtAuthGuard],
})
export class AuthModule {}
