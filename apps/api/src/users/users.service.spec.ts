import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '../generated/prisma/enums.js';
import { User, UserNameTakenError } from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';
import { UsersService } from './users.service.js';

const userRepositoryMock = {
  findById: vi.fn(),
  save: vi.fn(),
  findActiveByName: vi.fn(),
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
    it('returns conflict when the database rejects a duplicate name', async () => {
      userRepositoryMock.findById.mockResolvedValue(createUser());
      userRepositoryMock.save.mockRejectedValue(new UserNameTakenError());

      await expect(
        service.updateMe('user-123', { name: 'Taken' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

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

  describe('lookup', () => {
    it('looks up an exact trimmed name and returns public identity only', async () => {
      userRepositoryMock.findById.mockResolvedValue(
        createUser('Futa', 'ACTIVE'),
      );
      const identity = { id: 'other-user', name: '招待先' };
      userRepositoryMock.findActiveByName.mockResolvedValue(identity);

      await expect(service.lookup('user-123', '  招待先  ')).resolves.toEqual(
        identity,
      );
      expect(userRepositoryMock.findActiveByName).toHaveBeenCalledWith(
        '招待先',
      );
    });

    it('rejects onboarding requesters', async () => {
      userRepositoryMock.findById.mockResolvedValue(createUser());

      await expect(service.lookup('user-123', 'Futa')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(userRepositoryMock.findActiveByName).not.toHaveBeenCalled();
    });

    it('returns not found for a missing or onboarding target', async () => {
      userRepositoryMock.findById.mockResolvedValue(
        createUser('Futa', 'ACTIVE'),
      );
      userRepositoryMock.findActiveByName.mockResolvedValue(null);

      await expect(
        service.lookup('user-123', 'Missing'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
