import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { TripAccessService } from '../trips/trip-access.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { PostRepository } from './post.repository.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

const postId = '00000000-0000-4000-8000-000000000001';
const stampId = '00000000-0000-4000-8000-000000000002';
const categoryId = '00000000-0000-4000-8000-000000000003';
const tripId = '00000000-0000-4000-8000-000000000004';
const auth = { verifyAccessToken: vi.fn() };
const prisma = { user: { findUnique: vi.fn() } };
const access = {
  requireTrip: vi.fn(),
  requireCategory: vi.fn(),
  requireStamp: vi.fn(),
  requirePost: vi.fn(),
};
const repository = {
  create: vi.fn(),
  list: vi.fn(),
  findById: vi.fn(),
  setFavorite: vi.fn(),
  delete: vi.fn(),
  markRead: vi.fn(),
};

describe('PostsController', () => {
  let app: INestApplication;

  beforeEach(async () => {
    vi.resetAllMocks();
    auth.verifyAccessToken.mockResolvedValue({ sub: 'user', sid: 'session' });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    const module = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        PostsService,
        JwtAuthGuard,
        ActiveUserGuard,
        { provide: AuthTokenService, useValue: auth },
        { provide: PrismaService, useValue: prisma },
        { provide: TripAccessService, useValue: access },
        { provide: PostRepository, useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(['IMAGE', 'VIDEO'])(
    'rejects direct %s URL registration with upload instructions',
    async (mediaType) => {
      const result = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', 'Bearer token')
        .send({ stampId, mediaType, mediaUrl: 'https://example.com/media' })
        .expect(400);
      expect(result.body.message).toContain('POST /uploads/batches');
      expect(repository.create).not.toHaveBeenCalled();
    },
  );

  it.each([
    {},
    { stampId, mediaType: 'IMAGE' },
    { stampId, mediaType: 'IMAGE', mediaUrl: null },
    { stampId, mediaType: 'TEXT', mediaUrl: 'https://example.com/a' },
    { stampId, mediaType: 'VIDEO', mediaUrl: 'http://example.com/a' },
    {
      stampId,
      mediaType: 'VIDEO',
      mediaUrl: ['https://example.com/a', 'https://example.com/b'],
    },
    {
      stampId,
      mediaType: 'IMAGE',
      mediaUrl: 'https://example.com/a',
      authorId: 'someone-else',
    },
    {
      stampId,
      mediaType: 'IMAGE',
      mediaUrl: 'https://example.com/a',
      isFavorite: true,
    },
    { stampId: 'bad', mediaType: 'IMAGE', mediaUrl: 'https://example.com/a' },
  ])('rejects an invalid post body %o', async (body) => {
    await request(app.getHttpServer())
      .post('/posts')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it.each(['tripId', 'categoryId', 'stampId'] as const)(
    'lists favorite posts under %s',
    async (parentKey) => {
      repository.list.mockResolvedValue({
        items: [{ id: postId }],
        nextCursor: null,
      });
      const parentId = { tripId, categoryId, stampId }[parentKey];
      await request(app.getHttpServer())
        .get('/posts')
        .set('Authorization', 'Bearer token')
        .query({ [parentKey]: parentId, favoritesOnly: 'true', limit: '5' })
        .expect(200)
        .expect({ items: [{ id: postId }], nextCursor: null });
      expect(repository.list).toHaveBeenCalledWith(
        { type: parentKey.replace('Id', ''), id: parentId },
        expect.objectContaining({
          [parentKey]: parentId,
          favoritesOnly: true,
          limit: 5,
        }),
        'user',
      );
    },
  );

  it('preserves false as all posts and defaults to twenty items', async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', 'Bearer token')
      .query({ stampId, favoritesOnly: 'false' })
      .expect(200);
    expect(repository.list).toHaveBeenCalledWith(
      { type: 'stamp', id: stampId },
      expect.objectContaining({ favoritesOnly: false, limit: 20 }),
      'user',
    );
  });

  it.each([
    {},
    { tripId, categoryId },
    { categoryId, stampId },
    { tripId, stampId },
    { stampId, favoritesOnly: 'yes' },
    { stampId, limit: 0 },
    { stampId, limit: 101 },
    { stampId, unexpected: 'value' },
    { stampId: 'bad' },
  ])('rejects an invalid list query %o', async (query) => {
    await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', 'Bearer token')
      .query(query)
      .expect(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('gets a post and updates its shared favorite', async () => {
    repository.findById.mockResolvedValue({
      id: postId,
      stampId,
      categoryIds: [categoryId],
      tripId,
    });
    await request(app.getHttpServer())
      .get(`/posts/${postId}`)
      .set('Authorization', 'Bearer token')
      .expect(200)
      .expect({ id: postId, stampId, categoryIds: [categoryId], tripId });
    repository.setFavorite.mockResolvedValue({ id: postId, isFavorite: false });
    await request(app.getHttpServer())
      .patch(`/posts/${postId}/favorite`)
      .set('Authorization', 'Bearer token')
      .send({ isFavorite: false })
      .expect(200)
      .expect({ id: postId, isFavorite: false });
    expect(repository.setFavorite).toHaveBeenCalledWith(postId, false, 'user');
  });

  it.each([
    {},
    { isFavorite: null },
    { isFavorite: 'false' },
    { isFavorite: 1 },
    { isFavorite: true, extra: true },
  ])('rejects an invalid favorite body %o', async (body) => {
    await request(app.getHttpServer())
      .patch(`/posts/${postId}/favorite`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(repository.setFavorite).not.toHaveBeenCalled();
  });

  it('requires authentication for every route', async () => {
    await request(app.getHttpServer()).post('/posts').send({}).expect(401);
    await request(app.getHttpServer()).get('/posts').expect(401);
    await request(app.getHttpServer()).get(`/posts/${postId}`).expect(401);
    await request(app.getHttpServer())
      .patch(`/posts/${postId}/favorite`)
      .send({ isFavorite: true })
      .expect(401);
  });

  it('rejects onboarding users', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ONBOARDING });
    await request(app.getHttpServer())
      .get('/posts')
      .set('Authorization', 'Bearer token')
      .query({ stampId })
      .expect(403);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('returns 404 without exposing another trip post', async () => {
    access.requirePost.mockRejectedValue(
      new NotFoundException('Post not found'),
    );
    await request(app.getHttpServer())
      .get(`/posts/${postId}`)
      .set('Authorization', 'Bearer token')
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/posts/${postId}/favorite`)
      .set('Authorization', 'Bearer token')
      .send({ isFavorite: true })
      .expect(404);
    expect(repository.findById).not.toHaveBeenCalled();
    expect(repository.setFavorite).not.toHaveBeenCalled();
  });

  it('rejects invalid path IDs, disallows content edits and supports deletion', async () => {
    await request(app.getHttpServer())
      .get('/posts/invalid')
      .set('Authorization', 'Bearer token')
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Authorization', 'Bearer token')
      .send({})
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/posts/${postId}`)
      .set('Authorization', 'Bearer token')
      .expect(204);
    expect(repository.delete).toHaveBeenCalledWith(postId);
  });
});
