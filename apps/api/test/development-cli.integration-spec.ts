import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import request from 'supertest';
import { DEVELOPMENT_USERS, seedDevelopmentUsers } from '../scripts/users.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/database/prisma.service.js';

interface Tokens {
  user: { key: string; id: string; name: string; status: string };
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

// Use the real, separately compiled entrypoint, not a mocked implementation.
const entrypoint = fileURLToPath(
  new URL('../.dev-dist/scripts/cli.js', import.meta.url),
);
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));

function cli(
  args: string[],
  overrides: NodeJS.ProcessEnv = {},
): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      [entrypoint, ...args],
      {
        cwd: repositoryRoot,
        timeout: 15_000,
        env: {
          ...process.env,
          // Prove that the CLI never initializes Google/Apple identity providers.
          GOOGLE_OAUTH_CLIENT_ID: '',
          APPLE_OAUTH_CLIENT_ID: '',
          ...overrides,
        },
      },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== 'number') return reject(error);
        resolve({
          code: typeof error?.code === 'number' ? error.code : 0,
          stdout,
          stderr,
        });
      },
    );
  });
}

describe('Development seeder and token CLI integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  async function cleanDatabase() {
    // The existing database-test runner supplies a dedicated disposable DB.
    await prisma.trip.deleteMany();
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  async function token(key = 'dev-user-1'): Promise<Tokens> {
    const result = await cli(['token', '--user', key]);
    expect(result.stderr).toBe('');
    expect(result.code).toBe(0);
    return JSON.parse(result.stdout) as Tokens;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(cleanDatabase);

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('seeds three ACTIVE users without OAuth credentials, sessions, or domain data', async () => {
    const result = await cli(['seed'], {
      JWT_ACCESS_SECRET: '',
      JWT_ACCESS_TTL_SECONDS: '',
      REFRESH_TOKEN_TTL_DAYS: '',
    });
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      users: DEVELOPMENT_USERS.map((fixture) => ({
        ...fixture,
        name: fixture.key,
        status: 'ACTIVE',
      })),
      createdCount: 3,
      existingCount: 0,
    });
    expect(await prisma.user.count()).toBe(3);
    expect(await prisma.authAccount.count()).toBe(0);
    expect(await prisma.session.count()).toBe(0);
    expect(await prisma.trip.count()).toBe(0);
  });

  it('is idempotent and preserves renamed users, sessions, and domain data', async () => {
    await seedDevelopmentUsers(prisma);
    const owner = await token();
    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Renamed developer' })
      .expect(200);
    const trip = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Keep this trip',
        startDate: '2026-09-08',
        endDate: '2026-09-08',
      })
      .expect(201);
    const userBefore = await prisma.user.findUniqueOrThrow({
      where: { id: owner.user.id },
    });
    const unrelated = await prisma.user.create({
      data: { name: 'Unrelated', status: 'ACTIVE' },
    });

    const result = await cli(['seed']);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      createdCount: 0,
      existingCount: 3,
    });
    expect(
      await prisma.user.findUnique({ where: { id: owner.user.id } }),
    ).toEqual(userBefore);
    expect(
      await prisma.user.findUnique({ where: { id: unrelated.id } }),
    ).toEqual(unrelated);
    expect(
      await prisma.trip.findUnique({ where: { id: trip.body.id as string } }),
    ).not.toBeNull();
    expect(await prisma.session.count()).toBe(1);
    expect((await token()).user).toMatchObject({
      id: owner.user.id,
      name: 'Renamed developer',
    });
  });

  it('recreates missing fixtures and restores the same identities after a reset', async () => {
    await seedDevelopmentUsers(prisma);
    await prisma.user.delete({ where: { id: DEVELOPMENT_USERS[1].id } });
    expect(await seedDevelopmentUsers(prisma)).toMatchObject({
      createdCount: 1,
      existingCount: 2,
    });
    await cleanDatabase();
    const restored = await seedDevelopmentUsers(prisma);
    expect(restored.createdCount).toBe(3);
    expect(restored.users.map((user) => user.id)).toEqual(
      DEVELOPMENT_USERS.map((user) => user.id),
    );
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${(await token()).accessToken}`)
      .expect(200);
  });

  it('rolls back all new fixtures on a name conflict without adopting another user', async () => {
    const existing = await prisma.user.create({
      data: { name: 'dev-user-2', status: 'ACTIVE' },
    });
    const result = await cli(['seed']);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('already in use');
    expect(await prisma.user.findMany()).toEqual([existing]);
    const issued = await cli(['token', '--user', 'dev-user-2']);
    expect(issued.code).toBe(1);
    expect(issued.stderr).toContain('db:seed');
    expect(await prisma.session.count()).toBe(0);
  });

  it('issues API-compatible tokens with the normal TTL and stores only a refresh hash', async () => {
    await seedDevelopmentUsers(prisma);
    const issued = await token();
    const jwt = new JwtService();
    const payload = jwt.verify<{
      sub: string;
      sid: string;
      iat: number;
      exp: number;
    }>(issued.accessToken, {
      secret: process.env.JWT_ACCESS_SECRET,
    });
    expect(payload.sub).toBe(DEVELOPMENT_USERS[0].id);
    expect(payload.exp - payload.iat).toBe(
      Number(process.env.JWT_ACCESS_TTL_SECONDS),
    );
    expect(issued.accessTokenExpiresAt).toBe(
      new Date(payload.exp * 1000).toISOString(),
    );
    expect(() =>
      jwt.verify(issued.accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
        clockTimestamp: payload.exp,
      }),
    ).toThrow('jwt expired');

    const session = await prisma.session.findUniqueOrThrow({
      where: { id: payload.sid },
    });
    expect(session.userId).toBe(payload.sub);
    expect(session.refreshTokenHash).toBe(
      createHash('sha256').update(issued.refreshToken).digest('hex'),
    );
    expect(session.refreshTokenHash).not.toBe(issued.refreshToken);
    expect(session.expiresAt.toISOString()).toBe(issued.refreshTokenExpiresAt);
    const lifetime = session.expiresAt.getTime() - session.createdAt.getTime();
    expect(
      Math.abs(
        lifetime - Number(process.env.REFRESH_TOKEN_TTL_DAYS) * 86_400_000,
      ),
    ).toBeLessThan(5000);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${issued.accessToken}`)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({
          id: payload.sub,
          name: 'dev-user-1',
          status: 'ACTIVE',
        }),
      );
  });

  it('creates a new session on each issuance and supports refresh rotation and logout', async () => {
    await seedDevelopmentUsers(prisma);
    const first = await token();
    const second = await token();
    expect(first.accessToken).not.toBe(second.accessToken);
    expect(await prisma.session.count()).toBe(2);
    // A new issuance must not invalidate the previous access token.
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .expect(200);
    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    const rotated = refreshed.body as Tokens;
    expect(rotated.refreshToken).not.toBe(first.refreshToken);
    await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${rotated.accessToken}`)
      .expect(204);
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: rotated.refreshToken })
      .expect(401);
  });

  it('supports trip creation and invitations while enforcing participant access', async () => {
    await seedDevelopmentUsers(prisma);
    const owner = await token('dev-user-1');
    const invitee = await token('dev-user-2');
    const outsider = await token('dev-user-3');
    const trip = await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Development trip',
        startDate: '2026-09-08',
        endDate: '2026-09-09',
      })
      .expect(201);
    const tripId = trip.body.id as string;
    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .expect(404);
    const link = await request(app.getHttpServer())
      .post('/trips/' + tripId + '/invitation-links')
      .set('Authorization', 'Bearer ' + owner.accessToken)
      .expect(201);
    const invitation = await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', 'Bearer ' + invitee.accessToken)
      .send({ token: link.body.token })
      .expect(201);
    await request(app.getHttpServer())
      .get('/trips/' + tripId)
      .set('Authorization', 'Bearer ' + invitee.accessToken)
      .expect(404);
    await request(app.getHttpServer())
      .post('/invitations/' + invitation.body.id + '/confirm')
      .set('Authorization', 'Bearer ' + owner.accessToken)
      .send({ generation: invitation.body.generation })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${invitee.accessToken}`)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/trips/${tripId}`)
      .set('Authorization', `Bearer ${outsider.accessToken}`)
      .expect(404);
  });

  it('rejects missing users, unknown selectors, and ONBOARDING users without creating sessions', async () => {
    const missing = await cli(['token', '--user', 'dev-user-1']);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain('db:seed');
    const unknown = await cli(['token', '--user', randomUUID()]);
    expect(unknown.code).toBe(1);
    expect(unknown.stderr).toContain('Usage:');
    await seedDevelopmentUsers(prisma);
    await prisma.user.update({
      where: { id: DEVELOPMENT_USERS[0].id },
      data: { status: 'ONBOARDING', name: null },
    });
    const inactive = await cli(['token', '--user', 'dev-user-1']);
    expect(inactive.code).toBe(1);
    expect(inactive.stderr).toContain('ACTIVE');
    expect(await prisma.session.count()).toBe(0);
  });

  it.each(['GOOGLE', 'APPLE'] as const)(
    'rejects fixtures linked to %s',
    async (provider) => {
      await seedDevelopmentUsers(prisma);
      await prisma.authAccount.create({
        data: {
          userId: DEVELOPMENT_USERS[0].id,
          provider,
          providerAccountId: 'real-provider-account',
        },
      });
      const result = await cli(['token', '--user', 'dev-user-1']);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('linked to Google or Apple');
      expect(await prisma.session.count()).toBe(0);
    },
  );

  it('refuses unsafe environments before a database connection is attempted', async () => {
    for (const overrides of [
      {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost:1/stamp_rally',
      },
      { DATABASE_URL: 'postgresql://user:secret@remote.invalid/stamp_rally' },
      { DATABASE_URL: 'postgresql://localhost:1/production' },
      {
        DATABASE_URL:
          'postgresql://localhost:1/stamp_rally?host=remote.invalid',
      },
    ]) {
      const result = await cli(['seed'], overrides);
      expect(result.code).toBe(1);
      expect(result.stdout).toBe('');
      expect(result.stderr).not.toContain('secret');
      expect(result.stderr).not.toContain('Check the local database');
    }
    expect(await prisma.user.count()).toBe(0);
  });

  it('validates signing configuration before writing a session', async () => {
    await seedDevelopmentUsers(prisma);
    const result = await cli(['token', '--user', 'dev-user-1'], {
      JWT_ACCESS_TTL_SECONDS: '0',
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('JWT_ACCESS_TTL_SECONDS');
    expect(result.stdout).toBe('');
    expect(await prisma.session.count()).toBe(0);
  });
});
