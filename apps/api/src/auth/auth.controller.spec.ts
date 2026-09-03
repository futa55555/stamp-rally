import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from './auth-token/auth-token.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth/jwt-auth.guard.js';

const authServiceMock = {
  loginWithGoogle: vi.fn(),
  loginWithApple: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
};

const authTokenServiceMock = {
  verifyAccessToken: vi.fn(),
};

const identityToken =
  'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJwcm92aWRlci11c2VyIn0.c2lnbmF0dXJl';
const refreshToken = 'r'.repeat(43);
const sessionTokens = {
  accessToken: 'access-token',
  refreshToken,
  refreshTokenExpiresAt: new Date('2026-10-03T00:00:00.000Z'),
};

describe('AuthController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
        {
          provide: AuthTokenService,
          useValue: authTokenServiceMock,
        },
        JwtAuthGuard,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('logs in with Google', async () => {
    authServiceMock.loginWithGoogle.mockResolvedValue(sessionTokens);

    await request(app.getHttpServer())
      .post('/auth/google')
      .send({ idToken: identityToken })
      .expect(200)
      .expect({
        accessToken: 'access-token',
        refreshToken,
        refreshTokenExpiresAt: '2026-10-03T00:00:00.000Z',
      });

    expect(authServiceMock.loginWithGoogle).toHaveBeenCalledWith(identityToken);
  });

  it.each([
    {},
    { idToken: 'not-a-jwt' },
    { idToken: identityToken, unexpected: true },
  ])('rejects an invalid Google login body: %o', async (body) => {
    await request(app.getHttpServer())
      .post('/auth/google')
      .send(body)
      .expect(400);

    expect(authServiceMock.loginWithGoogle).not.toHaveBeenCalled();
  });

  it('logs in with Apple', async () => {
    authServiceMock.loginWithApple.mockResolvedValue(sessionTokens);

    await request(app.getHttpServer())
      .post('/auth/apple')
      .send({
        identityToken,
        nonce: 'nonce-123',
      })
      .expect(200);

    expect(authServiceMock.loginWithApple).toHaveBeenCalledWith(
      identityToken,
      'nonce-123',
    );
  });

  it('rejects an Apple login body without a nonce', async () => {
    await request(app.getHttpServer())
      .post('/auth/apple')
      .send({ identityToken })
      .expect(400);

    expect(authServiceMock.loginWithApple).not.toHaveBeenCalled();
  });

  it('refreshes a session', async () => {
    authServiceMock.refresh.mockResolvedValue(sessionTokens);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(200);

    expect(authServiceMock.refresh).toHaveBeenCalledWith(refreshToken);
  });

  it('rejects an invalid refresh token format', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'invalid' })
      .expect(400);

    expect(authServiceMock.refresh).not.toHaveBeenCalled();
  });

  it('logs out the authenticated session', async () => {
    authTokenServiceMock.verifyAccessToken.mockResolvedValue({
      sub: 'user-123',
      sid: 'session-456',
    });
    authServiceMock.logout.mockResolvedValue(undefined);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', 'Bearer access-token')
      .expect(204);

    expect(authTokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      'access-token',
    );
    expect(authServiceMock.logout).toHaveBeenCalledWith('session-456');
  });

  it('rejects logout without an access token', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(401);

    expect(authServiceMock.logout).not.toHaveBeenCalled();
  });
});
