import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { GenreRepository } from './genre.repository.js';
import { GenresService } from './genres.service.js';

describe('GenresService', () => {
  const repo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const access = { requireTrip: vi.fn(), requireGenre: vi.fn() };
  const service = new GenresService(
    repo as unknown as GenreRepository,
    access as unknown as TripAccessService,
  );
  const current = {
    id: 'genre',
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
    await service.update('participant', 'genre', { name: '  改名  ' });
    expect(access.requireGenre).toHaveBeenCalledWith('participant', 'genre');
    expect(repo.update).toHaveBeenCalledWith(
      'genre',
      {
        name: '改名',
        description: undefined,
      },
      'participant',
    );
  });

  it('allows clearing a description', async () => {
    await service.update('participant', 'genre', { description: '' });
    expect(repo.update).toHaveBeenCalledWith(
      'genre',
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
        service.update('participant', 'genre', dto),
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
    access.requireGenre.mockRejectedValue(new NotFoundException());
    await expect(service.findOne('outsider', 'genre')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('outsider', 'genre', { name: '変更' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
