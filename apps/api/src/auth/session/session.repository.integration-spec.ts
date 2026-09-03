import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../database/prisma.service.js';
import { SessionRepository } from './session.repository.js';

describe('SessionRepository integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: SessionRepository;

  const now = new Date('2026-09-03T00:00:00.000Z');
  const future = new Date('2026-10-03T00:00:00.000Z');
  const past = new Date('2026-09-02T00:00:00.000Z');

  async function cleanDatabase() {
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  async function createUser() {
    return prisma.user.create({
      data: {
        name: null,
      },
    });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
        }),
      ],
      providers: [PrismaService, SessionRepository],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(SessionRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await moduleRef.close();
  });

  it('creates a session', async () => {
    const user = await createUser();
    const refreshTokenHash = 'a'.repeat(64);

    const session = await repository.create(user.id, refreshTokenHash, future);

    const stored = await prisma.session.findUnique({
      where: {
        id: session.id,
      },
    });

    expect(stored).not.toBeNull();
    expect(stored?.userId).toBe(user.id);
    expect(stored?.refreshTokenHash).toBe(refreshTokenHash);
    expect(stored?.expiresAt).toEqual(future);
    expect(stored?.revokedAt).toBeNull();
  });

  it('finds an active session by refresh token hash', async () => {
    const user = await createUser();
    const refreshTokenHash = 'b'.repeat(64);

    const created = await repository.create(user.id, refreshTokenHash, future);

    const found = await repository.findActiveByRefreshTokenHash(
      refreshTokenHash,
      now,
    );

    expect(found?.id).toBe(created.id);
  });

  it('does not find an expired session', async () => {
    const user = await createUser();
    const refreshTokenHash = 'c'.repeat(64);

    await repository.create(user.id, refreshTokenHash, past);

    const found = await repository.findActiveByRefreshTokenHash(
      refreshTokenHash,
      now,
    );

    expect(found).toBeNull();
  });

  it('rotates a refresh token only once', async () => {
    const user = await createUser();
    const currentHash = 'd'.repeat(64);
    const nextHash = 'e'.repeat(64);

    const session = await repository.create(user.id, currentHash, future);

    const firstResult = await repository.rotateRefreshToken(
      session.id,
      currentHash,
      nextHash,
      future,
      now,
    );

    const secondResult = await repository.rotateRefreshToken(
      session.id,
      currentHash,
      'f'.repeat(64),
      future,
      now,
    );

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);

    const stored = await prisma.session.findUnique({
      where: {
        id: session.id,
      },
    });

    expect(stored?.refreshTokenHash).toBe(nextHash);
  });

  it('revokes an active session', async () => {
    const user = await createUser();
    const refreshTokenHash = 'f'.repeat(64);

    const session = await repository.create(user.id, refreshTokenHash, future);

    const firstResult = await repository.revoke(session.id, now);

    const secondResult = await repository.revoke(session.id, now);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(false);

    const found = await repository.findActiveByRefreshTokenHash(
      refreshTokenHash,
      now,
    );

    expect(found).toBeNull();

    const stored = await prisma.session.findUnique({
      where: {
        id: session.id,
      },
    });

    expect(stored?.revokedAt).toEqual(now);
  });
});
