import type { CoverAssetsService } from '../covers/cover-assets.service.js';
import type { CoverPresenter } from '../covers/cover-presenter.service.js';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { TripAccessService } from './trip-access.service.js';
import { Trip } from './entities/trip.entity.js';
import { TripRepository } from './trip.repository.js';
import { TripsService } from './trips.service.js';
import type { TripTemplatesService } from '../trip-templates/trip-templates.service.js';

describe('TripsService', () => {
  const tx = { tripMember: { findMany: vi.fn() } };
  const repo = {
    create: vi.fn(),
    findByRequestId: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    members: vi.fn(),
  };
  const access = { requireTrip: vi.fn() };
  const prisma = { $transaction: vi.fn() };
  const templates = { identified: vi.fn(), preview: vi.fn(), catalog: vi.fn() };
  const service = new TripsService(
    repo as unknown as TripRepository,
    access as unknown as TripAccessService,
    prisma as unknown as PrismaService,
    {} as CoverAssetsService,
    { present: async (value: unknown) => value } as CoverPresenter,
    templates as unknown as TripTemplatesService,
  );
  const input = {
    name: '  旅行  ',
    startDate: '2026-09-07',
    endDate: '2026-09-10',
  };
  let trip: Trip;

  beforeEach(() => {
    vi.resetAllMocks();
    tx.tripMember.findMany.mockResolvedValue([]);
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
    repo.findByRequestId.mockResolvedValue(null);
    templates.identified.mockReturnValue([]);
    templates.preview.mockReturnValue({ categories: [] });
    templates.catalog.mockReturnValue({ locations: [], activities: [] });
    repo.findAll.mockResolvedValue({ items: [], nextCursor: null });
    repo.findById.mockResolvedValue(trip);
    repo.save.mockImplementation(async (value: Trip) => value);
  });

  it('creates the trip in a serializable transaction', async () => {
    expect(await service.create('owner', input)).toEqual(trip.toJSON());
    expect(repo.create).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({ name: '旅行' }),
      tx,
      [],
      [],
      { locations: [], activities: [] },
    );
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'Serializable',
    });
  });

  it('creates only the validated selection in the trip transaction and retains activity metadata', async () => {
    const selectedCategories = [
      { name: '景色', stamps: [{ title: '海辺を散歩する' }] },
    ];
    templates.identified.mockReturnValue(selectedCategories);
    await service.create('owner', {
      ...input,
      locations: [' 沖縄 '],
      activityPresets: [' 海 '],
      customActivities: [' 自分だけの体験 ', ' '],
      selectedCategories,
    });
    expect(templates.identified).toHaveBeenCalledWith(
      { locations: ['沖縄'], activityPresets: ['海'] },
      selectedCategories,
    );
    expect(repo.create).toHaveBeenCalledWith(
      'owner',
      expect.objectContaining({
        locations: ['沖縄'],
        activityPresets: ['海'],
        customActivities: ['自分だけの体験'],
      }),
      tx,
      selectedCategories,
      [],
      { locations: [], activities: [] },
    );
  });

  it('returns an existing trip before checking a changed preset catalog or creating children', async () => {
    repo.findByRequestId.mockResolvedValue(trip);
    templates.identified.mockImplementation(() => {
      throw new BadRequestException('Preset was removed');
    });
    const result = await service.create('owner', {
      ...input,
      clientRequestId: 'request-id',
      activityPresets: ['以前のpreset'],
      selectedCategories: [
        { name: '以前のカテゴリー', stamps: [{ title: '以前のスタンプ' }] },
      ],
    });
    expect(result).toEqual(trip.toJSON());
    expect(access.requireTrip).toHaveBeenCalledWith('owner', trip.id);
    expect(repo.findByRequestId).toHaveBeenCalledWith(
      'owner',
      'request-id',
      tx,
    );
    expect(templates.identified).not.toHaveBeenCalled();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects selections outside the candidates before creating the trip', async () => {
    templates.identified.mockImplementation(() => {
      throw new BadRequestException('Unknown stamp');
    });
    await expect(
      service.create('owner', {
        ...input,
        selectedCategories: [
          { name: '景色', stamps: [{ title: '存在しない候補' }] },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.create).not.toHaveBeenCalled();
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
      coverAssetId: null,
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
