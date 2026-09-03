import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '../generated/prisma/enums.js';
import { User } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';
import { UsersService } from './users.service.js';

const userRepositoryMock = {
  findById: vi.fn(),
  save: vi.fn(),
};

function createUser(
  name: string | null = null,
  status: UserStatus = UserStatus.ONBOARDING,
): User {
  return new User(
    'user-123',
    name,
    status,
    new Date('2026-09-03T00:00:00.000Z'),
    new Date('2026-09-03T00:00:00.000Z'),
  );
}

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: userRepositoryMock,
        },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('getMe', () => {
    it('returns the authenticated user', async () => {
      const user = createUser();
      userRepositoryMock.findById.mockResolvedValue(user);

      const result = await service.getMe('user-123');

      expect(userRepositoryMock.findById).toHaveBeenCalledWith('user-123');
      expect(result).toBe(user);
    });

    it('throws when the user does not exist', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(service.getMe('missing-user')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates the name and activates the user', async () => {
      const user = createUser();

      userRepositoryMock.findById.mockResolvedValue(user);
      userRepositoryMock.save.mockImplementation(
        async (savedUser: User) => savedUser,
      );

      const result = await service.updateMe('user-123', {
        name: '  Futa  ',
      });

      expect(userRepositoryMock.save).toHaveBeenCalledWith(user);
      expect(result.name).toBe('Futa');
      expect(result.status).toBe(UserStatus.ACTIVE);
    });

    it('converts an invalid name into a bad request', async () => {
      const user = createUser();
      userRepositoryMock.findById.mockResolvedValue(user);

      await expect(
        service.updateMe('user-123', { name: '   ' }),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(userRepositoryMock.save).not.toHaveBeenCalled();
    });

    it('throws when the user does not exist', async () => {
      userRepositoryMock.findById.mockResolvedValue(null);

      await expect(
        service.updateMe('missing-user', { name: 'Futa' }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(userRepositoryMock.save).not.toHaveBeenCalled();
    });
  });
});
