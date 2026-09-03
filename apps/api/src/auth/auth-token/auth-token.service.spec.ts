import { Test, TestingModule } from '@nestjs/testing';
import { AccessTokenPayload, AuthTokenService } from './auth-token.service.js';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('AuthTokenService', () => {
  let service: AuthTokenService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: 'test-secret-that-is-long-enough',
          signOptions: {
            expiresIn: 900,
          },
        }),
      ],
      providers: [
        AuthTokenService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              if (key === 'REFRESH_TOKEN_TTL_DAYS') {
                return '30';
              }

              throw new Error(`Missing config: ${key}`);
            },
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthTokenService);
    jwtService = moduleRef.get(JwtService);
  });

  it('signs an access token containing user and session IDs', async () => {
    const token = await service.signAccessToken('user-123', 'session-456');

    const payload = await jwtService.verifyAsync<
      AccessTokenPayload & {
        iat: number;
        exp: number;
      }
    >(token);

    expect(payload.sub).toBe('user-123');
    expect(payload.sid).toBe('session-456');
    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeTypeOf('number');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('verifies an access token', async () => {
    const token = await service.signAccessToken('user-123', 'session-456');

    const payload = await service.verifyAccessToken(token);

    expect(payload).toEqual({
      sub: 'user-123',
      sid: 'session-456',
    });
  });

  it('rejects an access token without required payload', async () => {
    const token = await jwtService.signAsync({
      sub: 'user-123',
    });

    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token payload',
    );
  });

  it('generates different refresh tokens', () => {
    const first = service.generateRefreshToken();
    const second = service.generateRefreshToken();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('hashes a refresh token as SHA-256 hex', () => {
    const first = service.hashRefreshToken('refresh-token');
    const second = service.hashRefreshToken('refresh-token');
    const different = service.hashRefreshToken('another-token');

    expect(first).toHaveLength(64);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(first).toBe(second);
    expect(first).not.toBe(different);
  });

  it('calculates the refresh token expiration date', () => {
    const now = new Date('2026-09-03T00:00:00.000Z');

    const expiresAt = service.getRefreshTokenExpiresAt(now);

    expect(expiresAt.toISOString()).toBe('2026-10-03T00:00:00.000Z');
  });
});
