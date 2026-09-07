import { type INestApplication, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { TripAccessService } from '../trips/trip-access.service.js';
import { UserStatus } from '../generated/prisma/enums.js';
import { CommentRepository } from './comment.repository.js';
import { CommentsController } from './comments.controller.js';
import { CommentsService } from './comments.service.js';

const stampId = '00000000-0000-4000-8000-000000000001';
const repository = { create: vi.fn(), list: vi.fn() };
const access = { requireStamp: vi.fn() };
const auth = { verifyAccessToken: vi.fn() };
const prisma = { user: { findUnique: vi.fn() } };

describe('CommentsController', () => {
  let app: INestApplication;
  beforeEach(async () => {
    vi.resetAllMocks();
    auth.verifyAccessToken.mockResolvedValue({ sub: 'user', sid: 'session' });
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ACTIVE });
    const module = await Test.createTestingModule({
      controllers: [CommentsController],
      providers: [
        CommentsService,
        JwtAuthGuard,
        ActiveUserGuard,
        { provide: AuthTokenService, useValue: auth },
        { provide: PrismaService, useValue: prisma },
        { provide: TripAccessService, useValue: access },
        { provide: CommentRepository, useValue: repository },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  it('creates a text comment with the current author', async () => {
    repository.create.mockResolvedValue({
      id: 'comment',
      stampId,
      text: '行こう！',
      author: { id: 'user', name: 'Futa' },
    });
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', 'Bearer token')
      .send({ stampId, text: '  行こう！  ' })
      .expect(201)
      .expect({
        id: 'comment',
        stampId,
        text: '行こう！',
        author: { id: 'user', name: 'Futa' },
      });
    expect(repository.create).toHaveBeenCalledWith({
      stampId,
      authorId: 'user',
      text: '行こう！',
    });
  });

  it.each([
    {},
    { stampId },
    { stampId, text: null },
    { stampId, text: '' },
    { stampId, text: ' \n\t ' },
    { stampId, text: 1 },
    { stampId, text: ['text'] },
    { stampId: 'bad', text: 'hello' },
    { stampId, text: 'hello', authorId: 'someone-else' },
    { stampId, text: 'あ'.repeat(2001) },
  ])('rejects invalid comment input %#', async (body) => {
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists comments for one stamp with default pagination', async () => {
    repository.list.mockResolvedValue({ items: [], nextCursor: null });
    await request(app.getHttpServer())
      .get('/comments')
      .set('Authorization', 'Bearer token')
      .query({ stampId })
      .expect(200)
      .expect({ items: [], nextCursor: null });
    expect(access.requireStamp).toHaveBeenCalledWith('user', stampId);
    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ stampId, limit: 20 }),
    );
  });

  it.each([
    {},
    { stampId: 'bad' },
    { stampId, tripId: stampId },
    { stampId, limit: 0 },
    { stampId, limit: 101 },
  ])('rejects invalid comment list query %o', async (query) => {
    await request(app.getHttpServer())
      .get('/comments')
      .set('Authorization', 'Bearer token')
      .query(query)
      .expect(400);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('requires authentication and completed onboarding', async () => {
    await request(app.getHttpServer())
      .post('/comments')
      .send({ stampId, text: 'hello' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/comments')
      .query({ stampId })
      .expect(401);
    prisma.user.findUnique.mockResolvedValue({ status: UserStatus.ONBOARDING });
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', 'Bearer token')
      .send({ stampId, text: 'hello' })
      .expect(403);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects reading or posting comments to another trip', async () => {
    access.requireStamp.mockRejectedValue(
      new NotFoundException('Stamp not found'),
    );
    await request(app.getHttpServer())
      .get('/comments')
      .set('Authorization', 'Bearer token')
      .query({ stampId })
      .expect(404);
    await request(app.getHttpServer())
      .post('/comments')
      .set('Authorization', 'Bearer token')
      .send({ stampId, text: 'hello' })
      .expect(404);
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });
});
