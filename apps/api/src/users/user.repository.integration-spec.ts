import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { User } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';

describe('UserRepository integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: UserRepository;

  async function cleanDatabase() {
    await prisma.session.deleteMany();
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
      providers: [PrismaService, UserRepository],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(UserRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await moduleRef.close();
  });

  it('finds a user as a domain model', async () => {
    const createdUser = await prisma.user.create({
      data: {
        name: null,
      },
    });

    const user = await repository.findById(createdUser.id);

    expect(user).toBeInstanceOf(User);
    expect(user?.id).toBe(createdUser.id);
    expect(user?.name).toBeNull();
    expect(user?.status).toBe(UserStatus.ONBOARDING);
    expect(user?.createdAt).toEqual(createdUser.createdAt);
    expect(user?.updatedAt).toEqual(createdUser.updatedAt);
  });

  it('returns null when the user does not exist', async () => {
    const user = await repository.findById(
      '00000000-0000-0000-0000-000000000000',
    );

    expect(user).toBeNull();
  });

  it('saves changes from the domain model', async () => {
    const createdUser = await prisma.user.create({
      data: {
        name: null,
      },
    });

    const user = await repository.findById(createdUser.id);

    expect(user).not.toBeNull();

    user!.updateName('  Futa  ');

    const savedUser = await repository.save(user!);

    expect(savedUser).toBeInstanceOf(User);
    expect(savedUser.name).toBe('Futa');
    expect(savedUser.status).toBe(UserStatus.ACTIVE);

    const persistedUser = await prisma.user.findUniqueOrThrow({
      where: {
        id: createdUser.id,
      },
    });

    expect(persistedUser.name).toBe('Futa');
    expect(persistedUser.status).toBe(UserStatus.ACTIVE);
  });
});
