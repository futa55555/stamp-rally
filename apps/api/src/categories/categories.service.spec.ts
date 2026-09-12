import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CategoryRepository } from './category.repository.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesService', () => {
  const repo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const access = { requireTrip: vi.fn(), requireCategory: vi.fn() };
  const service = new CategoriesService(
    repo as unknown as CategoryRepository,
    access as unknown as TripAccessService,
  );
  const current = {
    id: 'category',
    tripId: 'trip',
    name: '既存',
    description: '既存の説明',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findById.mockResolvedValue(current);
  });

  it('allows participants to create children after the parent already exists', async () => {
    await service.create('participant', { tripId: 'trip', name: '  新規  ' });
    expect(access.requireTrip).toHaveBeenCalledWith('participant', 'trip');
    expect(repo.create).toHaveBeenCalledWith(
      {
        tripId: 'trip',
        name: '新規',
        description: '',
      },
      'participant',
    );
  });

  it('updates only supplied fields', async () => {
    await service.update('participant', 'category', { name: '  改名  ' });
    expect(access.requireCategory).toHaveBeenCalledWith(
      'participant',
      'category',
    );
    expect(repo.update).toHaveBeenCalledWith(
      'category',
      {
        name: '改名',
        description: undefined,
      },
      'participant',
    );
  });

  it('allows clearing a description', async () => {
    await service.update('participant', 'category', { description: '' });
    expect(repo.update).toHaveBeenCalledWith(
      'category',
      {
        name: undefined,
        description: '',
      },
      'participant',
    );
  });

  it.each([{}, { name: '  ' }, { description: 'あ'.repeat(2001) }])(
    'rejects invalid updates %o',
    async (dto) => {
      await expect(
        service.update('participant', 'category', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    },
  );

  it('denies parent-scoped create and list operations before repository access', async () => {
    access.requireTrip.mockRejectedValue(new NotFoundException());
    await expect(
      service.create('outsider', { tripId: 'trip', name: '新規' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findAll('outsider', { tripId: 'trip', limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('denies child reads and edits before repository access', async () => {
    access.requireCategory.mockRejectedValue(new NotFoundException());
    await expect(
      service.findOne('outsider', 'category'),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.update('outsider', 'category', { name: '変更' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
