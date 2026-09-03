import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { AuthAccountRepository } from './auth-account.repository.js';
import { ConfigModule } from '@nestjs/config';
import { AuthProvider, UserStatus } from '../generated/prisma/enums.js';

describe('AuthAccountRepository integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: AuthAccountRepository;

  async function cleanDatabase() {
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
        }),
      ],
      providers: [PrismaService, AuthAccountRepository],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(AuthAccountRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await moduleRef.close();
  });

  it('creates a user and auth account', async () => {
    const user = await repository.createUserWithIdentity(
      AuthProvider.GOOGLE,
      'google-user-123',
    );

    expect(user.name).toBeNull();
    expect(user.status).toBe(UserStatus.ONBOARDING);

    const account = await prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: AuthProvider.GOOGLE,
          providerAccountId: 'google-user-123',
        },
      },
    });

    expect(account).not.toBeNull();
    expect(account?.userId).toBe(user.id);
  });

  it('finds a user by provider identity', async () => {
    const craeted = await repository.createUserWithIdentity(
      AuthProvider.APPLE,
      'apple-user-123',
    );

    const found = await repository.findUserByIdentity(
      AuthProvider.APPLE,
      'apple-user-123',
    );

    expect(found?.id).toBe(craeted.id);
  });

  it('returns null when the identity does not exist', async () => {
    const found = await repository.findUserByIdentity(
      AuthProvider.GOOGLE,
      'missing-user',
    );

    expect(found).toBeNull();
  });

  it('does not leave an orphan user when identity creation fails', async () => {
    await repository.createUserWithIdentity(
      AuthProvider.GOOGLE,
      'duplicate-user',
    );

    await expect(
      repository.createUserWithIdentity(AuthProvider.GOOGLE, 'duplicate-user'),
    ).rejects.toThrow();

    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.authAccount.count()).toBe(1);
  });
});
