import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { AuthProvider, UserStatus } from '../generated/prisma/enums.js';
import { AppleIdentityService } from './apple-identity/apple-identity.service.js';
import { AuthAccountRepository } from './auth-account.repository.js';
import { AuthTokenService } from './auth-token/auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { GoogleIdentityService } from './google-identity/google-identity.service.js';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard.js';
import { SessionRepository } from './session/session.repository.js';
import { SessionService } from './session/session.service.js';

const googleIdentityServiceMock = {
  verifyIdToken: vi.fn(),
};

const appleIdentityServiceMock = {
  verifyIdentityToken: vi.fn(),
};

const googleIdToken =
  'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJnb29nbGUtdXNlciJ9.c2lnbmF0dXJl';
const appleIdentityToken =
  'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhcHBsZS11c2VyIn0.c2lnbmF0dXJl';

type SessionTokenResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
};

describe('Auth flow integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authTokenService: AuthTokenService;

  async function cleanDatabase() {
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  async function loginWithGoogle(
    providerAccountId = 'google-user-123',
  ): Promise<SessionTokenResponse> {
    googleIdentityServiceMock.verifyIdToken.mockResolvedValue({
      providerAccountId,
    });

    const response = await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: googleIdToken })
      .expect(200);

    return response.body as SessionTokenResponse;
  }

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
          isGlobal: true,
          load: [
            () => ({
              REFRESH_TOKEN_TTL_DAYS: '30',
            }),
          ],
        }),
        JwtModule.register({
          secret: 'integration-test-access-token-secret',
          signOptions: {
            expiresIn: 900,
          },
        }),
        DatabaseModule,
      ],
      controllers: [AuthController],
      providers: [
        AuthAccountRepository,
        AuthTokenService,
        AuthService,
        JwtAuthGuard,
        SessionRepository,
        SessionService,
        {
          provide: GoogleIdentityService,
          useValue: googleIdentityServiceMock,
        },
        {
          provide: AppleIdentityService,
          useValue: appleIdentityServiceMock,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    authTokenService = moduleRef.get(AuthTokenService);
  });

  beforeEach(async () => {
    vi.resetAllMocks();
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('creates a Google user, auth account, and session', async () => {
    const tokens = await loginWithGoogle();

    expect(tokens.accessToken).toBeTypeOf('string');
    expect(tokens.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(new Date(tokens.refreshTokenExpiresAt).getTime()).not.toBeNaN();

    expect(googleIdentityServiceMock.verifyIdToken).toHaveBeenCalledWith(
      googleIdToken,
    );

    const account = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: 'google-user-123',
        },
      },
      include: {
        user: true,
      },
    });

    expect(account).not.toBeNull();
    expect(account?.user.status).toBe(UserStatus.ONBOARDING);

    const accessTokenPayload = await authTokenService.verifyAccessToken(
      tokens.accessToken,
    );

    expect(accessTokenPayload.sub).toBe(account?.userId);

    const session = await prisma.session.findUnique({
      where: {
        id: accessTokenPayload.sid,
      },
    });

    expect(session?.userId).toBe(account?.userId);
    expect(session?.refreshTokenHash).toBe(
      authTokenService.hashRefreshToken(tokens.refreshToken),
    );
    expect(session?.revokedAt).toBeNull();
  });

  it('reuses the user and creates another session on Google re-login', async () => {
    const firstTokens = await loginWithGoogle();
    const secondTokens = await loginWithGoogle();

    const firstPayload = await authTokenService.verifyAccessToken(
      firstTokens.accessToken,
    );
    const secondPayload = await authTokenService.verifyAccessToken(
      secondTokens.accessToken,
    );

    expect(secondPayload.sub).toBe(firstPayload.sub);
    expect(secondPayload.sid).not.toBe(firstPayload.sid);
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authAccount.count()).toBe(1);
    expect(await prisma.session.count()).toBe(2);
  });

  it('creates an Apple user from a verified identity', async () => {
    appleIdentityServiceMock.verifyIdentityToken.mockResolvedValue({
      providerAccountId: 'apple-user-123',
    });

    const response = await request(app.getHttpServer())
      .post('/auth/apple')
      .send({
        identityToken: appleIdentityToken,
        nonce: 'nonce-123',
      })
      .expect(200);

    const tokens = response.body as SessionTokenResponse;

    expect(appleIdentityServiceMock.verifyIdentityToken).toHaveBeenCalledWith(
      appleIdentityToken,
      'nonce-123',
    );

    const account = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.APPLE,
          providerAccountId: 'apple-user-123',
        },
      },
    });

    const accessTokenPayload = await authTokenService.verifyAccessToken(
      tokens.accessToken,
    );

    expect(account).not.toBeNull();
    expect(accessTokenPayload.sub).toBe(account?.userId);
    expect(await prisma.session.count()).toBe(1);
  });

  it('rotates the refresh token and rejects reuse of the old token', async () => {
    const loginTokens = await loginWithGoogle();
    const loginPayload = await authTokenService.verifyAccessToken(
      loginTokens.accessToken,
    );

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(200);

    const refreshedTokens = response.body as SessionTokenResponse;
    const refreshedPayload = await authTokenService.verifyAccessToken(
      refreshedTokens.accessToken,
    );

    expect(refreshedTokens.refreshToken).not.toBe(loginTokens.refreshToken);
    expect(refreshedPayload.sub).toBe(loginPayload.sub);
    expect(refreshedPayload.sid).toBe(loginPayload.sid);

    const session = await prisma.session.findUnique({
      where: {
        id: loginPayload.sid,
      },
    });

    expect(session?.refreshTokenHash).toBe(
      authTokenService.hashRefreshToken(refreshedTokens.refreshToken),
    );

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: loginTokens.refreshToken })
      .expect(401);
  });

  it('revokes the session on logout', async () => {
    const tokens = await loginWithGoogle();
    const payload = await authTokenService.verifyAccessToken(
      tokens.accessToken,
    );

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(204);

    const session = await prisma.session.findUnique({
      where: {
        id: payload.sid,
      },
    });

    expect(session?.revokedAt).not.toBeNull();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: tokens.refreshToken })
      .expect(401);
  });
});
