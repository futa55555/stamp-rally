import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { TripAccessService } from './trip-access.service.js';
import { InvitationRepository } from '../invitations/invitation.repository.js';
import { Trip } from './entities/trip.entity.js';
import { TripRepository } from './trip.repository.js';
import { TripsService } from './trips.service.js';

describe('TripsService', () => {
  const tx = {};
  const repo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    members: vi.fn(),
  };
  const access = { requireTrip: vi.fn() };
  const invitations = { createInitial: vi.fn() };
  const prisma = { $transaction: vi.fn() };
  const service = new TripsService(
    repo as unknown as TripRepository,
    access as unknown as TripAccessService,
    invitations as unknown as InvitationRepository,
    prisma as unknown as PrismaService,
  );
  const input = {
    name: '  旅行  ',
    startDate: '2026-09-07',
    endDate: '2026-09-10',
    inviteeNames: ['友達'],
  };
  let trip: Trip;

  beforeEach(() => {
    vi.resetAllMocks();
    trip = new Trip(
      'trip',
      '旅行',
      '2026-09-07',
      '2026-09-10',
      'https://example.com/image.jpg',
      'owner',
      new Date(),
      new Date(),
    );
    prisma.$transaction.mockImplementation(
      (work: (client: object) => Promise<unknown>) => work(tx),
    );
    repo.create.mockResolvedValue(trip);
    repo.findById.mockResolvedValue(trip);
    repo.save.mockImplementation(async (value: Trip) => value);
  });

  it('creates the trip and initial invitations in the same serializable transaction', async () => {
    expect(await service.create('owner', input)).toBe(trip);
    expect(repo.create).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ name: '旅行' }),
      tx,
    );
    expect(invitations.createInitial).toHaveBeenCalledWith(
      tx,
      'trip',
      'owner',
      ['友達'],
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('propagates an invitation failure through the transaction', async () => {
    invitations.createInitial.mockRejectedValue(
      new NotFoundException('Invitee not found'),
    );
    await expect(service.create('owner', input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    { ...input, startDate: '2026-09-11' },
    { ...input, startDate: '2026-02-29' },
    { ...input, name: '  ' },
  ])('rejects invalid trip before creating data', async (dto) => {
    await expect(service.create('owner', dto)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('allows another participant to edit and clear the cover', async () => {
    const result = await service.update('participant', 'trip', {
      coverImageUrl: null,
      name: '  更新  ',
    });
    expect(access.requireTrip).toHaveBeenCalledWith('participant', 'trip');
    expect(result.name).toBe('更新');
    expect(result.coverImageUrl).toBeNull();
    expect(result.startDate).toBe('2026-09-07');
  });

  it.each([{ startDate: '2026-09-11' }, { endDate: '2026-09-06' }, {}])(
    'rejects invalid partial updates %o',
    async (dto) => {
      await expect(service.update('owner', 'trip', dto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(repo.save).not.toHaveBeenCalled();
    },
  );

  it('checks membership before reading, updating, or listing members', async () => {
    access.requireTrip.mockRejectedValue(new NotFoundException());
    await expect(service.findOne('outsider', 'trip')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('outsider', 'trip', { name: '変更' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.members('outsider', 'trip', new PaginationQueryDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.members).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('scopes the trip list to the current user', async () => {
    const query = new PaginationQueryDto();
    await service.findAll('participant', query);
    expect(repo.findAll).toHaveBeenCalledWith('participant', query);
  });
});
