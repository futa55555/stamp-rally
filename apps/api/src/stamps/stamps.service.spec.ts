import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { StampRepository } from './stamp.repository.js';
import { StampsService } from './stamps.service.js';

describe('StampsService', () => {
  const repo = {
    create: vi.fn(),
    findAll: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
  };
  const access = {
    requireTrip: vi.fn(),
    requireGenre: vi.fn(),
    requireStamp: vi.fn(),
  };
  const service = new StampsService(
    repo as unknown as StampRepository,
    access as unknown as TripAccessService,
  );
  const current = {
    id: 'stamp',
    tripId: 'genre',
    genreIds: ['genre'],
    name: '既存',
    description: '既存の説明',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    repo.findById.mockResolvedValue(current);
  });

  it('allows participants to create children after the parent already exists', async () => {
    await service.create('participant', {
      tripId: 'genre',
      genreIds: ['genre'],
      name: '  新規  ',
    });
    expect(access.requireTrip).toHaveBeenCalledWith('participant', 'genre');
    expect(repo.create).toHaveBeenCalledWith(
      {
        tripId: 'genre',
        genreIds: ['genre'],
        name: '新規',
        description: '',
      },
      'participant',
    );
  });

  it('updates only supplied fields', async () => {
    await service.update('participant', 'stamp', { name: '  改名  ' });
    expect(access.requireStamp).toHaveBeenCalledWith('participant', 'stamp');
    expect(repo.update).toHaveBeenCalledWith(
      'stamp',
      {
        name: '改名',
        description: undefined,
        genreIds: undefined,
      },
      'participant',
    );
  });

  it('allows clearing a description', async () => {
    await service.update('participant', 'stamp', { description: '' });
    expect(repo.update).toHaveBeenCalledWith(
      'stamp',
      {
        name: undefined,
        genreIds: undefined,
        description: '',
      },
      'participant',
    );
  });

  it.each([{}, { name: '  ' }, { description: 'あ'.repeat(2001) }])(
    'rejects invalid updates %o',
    async (dto) => {
      await expect(
        service.update('participant', 'stamp', dto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    },
  );

  it('denies parent-scoped create and list operations before repository access', async () => {
    access.requireTrip.mockRejectedValue(new NotFoundException());
    access.requireGenre.mockRejectedValue(new NotFoundException());
    await expect(
      service.create('outsider', {
        tripId: 'genre',
        genreIds: ['genre'],
        name: '新規',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      service.findAll('outsider', { genreId: 'genre', limit: 20 }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.findAll).not.toHaveBeenCalled();
  });

  it('denies child reads and edits before repository access', async () => {
    access.requireStamp.mockRejectedValue(new NotFoundException());
    await expect(service.findOne('outsider', 'stamp')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.update('outsider', 'stamp', { name: '変更' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findById).not.toHaveBeenCalled();
    expect(repo.update).not.toHaveBeenCalled();
  });
});
