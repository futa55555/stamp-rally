import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { MediaType } from '../generated/prisma/enums.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import { PostRepository } from './post.repository.js';
import { PostsService } from './posts.service.js';

const repository = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  setFavorite: vi.fn(),
  markRead: vi.fn(),
  original: vi.fn(),
};
const access = {
  requireTrip: vi.fn(),
  requireGenre: vi.fn(),
  requireStamp: vi.fn(),
  requirePost: vi.fn(),
};

describe('PostsService', () => {
  let service: PostsService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new PostsService(
      repository as unknown as PostRepository,
      access as unknown as TripAccessService,
    );
  });

  it.each([MediaType.IMAGE, MediaType.VIDEO])(
    'rejects direct %s URL registration and points clients to uploads',
    async (mediaType) => {
      await expect(
        service.create('user', {
          stampId: 'stamp',
          mediaType,
          mediaUrl: 'https://example.com/media',
        }),
      ).rejects.toThrow('POST /uploads/batches');
      expect(access.requireStamp).toHaveBeenCalledWith('user', 'stamp');
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    [MediaType.IMAGE, ''],
    [MediaType.VIDEO, 'http://example.com/media'],
    [MediaType.IMAGE, 'javascript:alert(1)'],
    [MediaType.IMAGE, `https://example.com/${'a'.repeat(2048)}`],
    ['TEXT', 'https://example.com/media'],
  ])('rejects invalid media %s %s', async (mediaType, mediaUrl) => {
    await expect(
      service.create('user', {
        stampId: 'stamp',
        mediaType: mediaType as MediaType,
        mediaUrl,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not create a post in an inaccessible stamp', async () => {
    access.requireStamp.mockRejectedValue(new NotFoundException());
    await expect(
      service.create('outsider', {
        stampId: 'stamp',
        mediaType: MediaType.IMAGE,
        mediaUrl: 'https://example.com/a.jpg',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each([
    ['tripId', 'trip', 'requireTrip'],
    ['genreId', 'genre', 'requireGenre'],
    ['stampId', 'stamp', 'requireStamp'],
  ] as const)(
    'authorizes %s before listing favorite posts',
    async (key, type, accessMethod) => {
      const query = Object.assign(new ListPostsDto(), {
        [key]: 'parent',
        favoritesOnly: true,
      });
      repository.list.mockResolvedValue({ items: [], nextCursor: null });
      await expect(service.findAll('user', query)).resolves.toEqual({
        items: [],
        nextCursor: null,
      });
      expect(access[accessMethod]).toHaveBeenCalledWith('user', 'parent');
      expect(repository.list).toHaveBeenCalledWith(
        { type, id: 'parent' },
        query,
        'user',
      );
    },
  );

  it.each([
    {},
    { tripId: 'trip', genreId: 'genre' },
    { tripId: 'trip', stampId: 'stamp' },
    { genreId: 'genre', stampId: 'stamp' },
  ])('rejects ambiguous or missing list scope %o', async (scope) => {
    await expect(
      service.findAll('user', Object.assign(new ListPostsDto(), scope)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('does not read posts from an inaccessible parent', async () => {
    access.requireGenre.mockRejectedValue(new NotFoundException());
    await expect(
      service.findAll(
        'outsider',
        Object.assign(new ListPostsDto(), { genreId: 'genre' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('does not expose a post or change its favorite to an outsider', async () => {
    access.requirePost.mockRejectedValue(new NotFoundException());
    await expect(service.findOne('outsider', 'post')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.setFavorite('outsider', 'post', true),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.setFavorite).not.toHaveBeenCalled();
  });

  it('returns a post after verifying membership', async () => {
    const post = {
      id: 'post',
      tripId: 'trip',
      genreIds: ['genre'],
      stampId: 'stamp',
    };
    repository.findById.mockResolvedValue(post);
    await expect(service.findOne('user', 'post')).resolves.toBe(post);
    expect(access.requirePost).toHaveBeenCalledWith('user', 'post');
  });

  it('returns 404 if an authorized post no longer exists', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.findOne('user', 'post')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('sets the shared favorite explicitly, including repeated false', async () => {
    await service.setFavorite('member-a', 'post', true);
    await service.setFavorite('member-b', 'post', false);
    await service.setFavorite('member-b', 'post', false);
    expect(repository.setFavorite.mock.calls).toEqual([
      ['post', true, 'member-a'],
      ['post', false, 'member-b'],
      ['post', false, 'member-b'],
    ]);
  });
  it.each([MediaType.IMAGE, MediaType.VIDEO])(
    'marks ready %s media read',
    async (mediaType) => {
      repository.findById.mockResolvedValue({ id: 'post', mediaType });
      repository.markRead.mockResolvedValue({ id: 'post', readAt: new Date() });
      await service.markRead('user', 'post');
      expect(repository.markRead).toHaveBeenCalledWith('post', 'user');
    },
  );

  it('authorizes original downloads separately from display reads', async () => {
    repository.original.mockResolvedValue({
      url: 'https://r2.test/original',
      fileName: 'camera.heic',
    });
    await expect(service.original('user', 'post')).resolves.toMatchObject({
      fileName: 'camera.heic',
    });
    expect(access.requirePost).toHaveBeenCalledWith('user', 'post');
    expect(repository.original).toHaveBeenCalledWith('post', 'user');
    access.requirePost.mockRejectedValue(new NotFoundException());
    await expect(service.original('outsider', 'post')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
