import { type INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { DatabaseModule } from '../database/database.module.js';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { UserRepository } from './user.repository.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

type UserResponse = {
  id: string;
  name: string | null;
  status: UserStatus;
  createdAt: string;
  updatedAt: string;
};

describe('Users flow integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authTokenService: AuthTokenService;

  async function cleanDatabase() {
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  async function createAuthenticatedUser() {
    const user = await prisma.user.create({
      data: {
        name: null,
      },
    });

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: 'a'.repeat(64),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    const accessToken = await authTokenService.signAccessToken(
      user.id,
      session.id,
    );

    return {
      user,
      accessToken,
    };
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
      controllers: [UsersController],
      providers: [AuthTokenService, JwtAuthGuard, UserRepository, UsersService],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    prisma = moduleRef.get(PrismaService);
    authTokenService = moduleRef.get(AuthTokenService);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('returns the authenticated user', async () => {
    const { user, accessToken } = await createAuthenticatedUser();

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as UserResponse;

    expect(body.id).toBe(user.id);
    expect(body.name).toBeNull();
    expect(body.status).toBe(UserStatus.ONBOARDING);
  });

  it('updates the authenticated user and completes onboarding', async () => {
    const { user, accessToken } = await createAuthenticatedUser();

    const response = await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '  Futa  ',
      })
      .expect(200);

    const body = response.body as UserResponse;

    expect(body.id).toBe(user.id);
    expect(body.name).toBe('Futa');
    expect(body.status).toBe(UserStatus.ACTIVE);

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(persistedUser.name).toBe('Futa');
    expect(persistedUser.status).toBe(UserStatus.ACTIVE);
  });

  it('does not update the user with an invalid name', async () => {
    const { user, accessToken } = await createAuthenticatedUser();

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: '   ',
      })
      .expect(400);

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: user.id,
      },
    });

    expect(persistedUser.name).toBeNull();
    expect(persistedUser.status).toBe(UserStatus.ONBOARDING);
  });

  it('rejects a request without an access token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });
});
