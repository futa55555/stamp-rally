import { type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

const usersServiceMock = {
  getMe: vi.fn(),
  updateMe: vi.fn(),
};

const authTokenServiceMock = {
  verifyAccessToken: vi.fn(),
};

const userResponse = {
  id: 'user-123',
  name: null,
  status: UserStatus.ONBOARDING,
  createdAt: new Date('2026-09-03T00:00:00.000Z'),
  updatedAt: new Date('2026-09-03T00:00:00.000Z'),
};

describe('UsersController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();

    authTokenServiceMock.verifyAccessToken.mockResolvedValue({
      sub: 'user-123',
      sid: 'session-456',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: usersServiceMock,
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

  it('returns the authenticated user', async () => {
    usersServiceMock.getMe.mockResolvedValue(userResponse);

    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', 'Bearer access-token')
      .expect(200)
      .expect({
        id: 'user-123',
        name: null,
        status: UserStatus.ONBOARDING,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      });

    expect(authTokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      'access-token',
    );
    expect(usersServiceMock.getMe).toHaveBeenCalledWith('user-123');
  });

  it('rejects get me without an access token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);

    expect(usersServiceMock.getMe).not.toHaveBeenCalled();
  });

  it('updates the authenticated user', async () => {
    usersServiceMock.updateMe.mockResolvedValue({
      ...userResponse,
      name: 'Futa',
      status: UserStatus.ACTIVE,
    });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', 'Bearer access-token')
      .send({
        name: '  Futa  ',
      })
      .expect(200)
      .expect({
        id: 'user-123',
        name: 'Futa',
        status: UserStatus.ACTIVE,
        createdAt: '2026-09-03T00:00:00.000Z',
        updatedAt: '2026-09-03T00:00:00.000Z',
      });

    expect(usersServiceMock.updateMe).toHaveBeenCalledWith('user-123', {
      name: 'Futa',
    });
  });

  it.each([
    {},
    { name: '' },
    { name: '   ' },
    { name: 'あ'.repeat(21) },
    { name: 123 },
    { name: 'Futa', unexpected: true },
  ])('rejects an invalid update body: %o', async (body) => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', 'Bearer access-token')
      .send(body)
      .expect(400);

    expect(usersServiceMock.updateMe).not.toHaveBeenCalled();
  });

  it('rejects update me without an access token', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({
        name: 'Futa',
      })
      .expect(401);

    expect(usersServiceMock.updateMe).not.toHaveBeenCalled();
  });
});
