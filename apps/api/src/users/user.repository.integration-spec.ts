import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { User, UserNameTakenError } from './entities/user.entity.js';
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

  it('allows multiple null names and the current name to be saved again', async () => {
    await prisma.user.createMany({ data: [{ name: null }, { name: null }] });
    const created = await prisma.user.create({
      data: { name: '同じ名前', status: 'ACTIVE' },
    });
    const user = (await repository.findById(created.id))!;

    user.updateName('  同じ名前  ');

    await expect(repository.save(user)).resolves.toMatchObject({
      name: '同じ名前',
    });
    expect(await prisma.user.count({ where: { name: null } })).toBe(2);
  });

  it('allows exactly one concurrent claimant for a name', async () => {
    const first = await prisma.user.create({ data: {} });
    const second = await prisma.user.create({ data: {} });
    const users = await Promise.all([
      repository.findById(first.id),
      repository.findById(second.id),
    ]);

    users.forEach((user) => user!.updateName('Shared'));
    const results = await Promise.allSettled(
      users.map((user) => repository.save(user!)),
    );

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failure = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failure.reason).toBeInstanceOf(UserNameTakenError);
    expect(await prisma.user.count({ where: { name: 'Shared' } })).toBe(1);
    expect(
      await prisma.user.count({ where: { name: null, status: 'ONBOARDING' } }),
    ).toBe(1);
  });

  it('looks up active users case-sensitively with only public identity fields', async () => {
    const upper = await prisma.user.create({
      data: { name: 'Futa', status: 'ACTIVE' },
    });
    const lower = await prisma.user.create({
      data: { name: 'futa', status: 'ACTIVE' },
    });
    await prisma.user.create({ data: { name: 'Onboarding' } });

    await expect(repository.findActiveByName('Futa')).resolves.toEqual({
      id: upper.id,
      name: 'Futa',
    });
    await expect(repository.findActiveByName('futa')).resolves.toEqual({
      id: lower.id,
      name: 'futa',
    });
    await expect(repository.findActiveByName('FUTA')).resolves.toBeNull();
    await expect(repository.findActiveByName('Onboarding')).resolves.toBeNull();
  });
});
