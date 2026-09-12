import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesService } from './categories.service.js';

describe('CategoriesController', () => {
  let app: INestApplication;
  const id = '31fc6c40-7810-4b31-9d59-8b7042479410';
  const valid = { tripId: id, name: '  名前  ' };
  const service = {
    create: vi.fn(),
    findAll: vi.fn(),
    findOne: vi.fn(),
    update: vi.fn(),
    members: vi.fn(),
  };
  const tokens = { verifyAccessToken: vi.fn() };
  const prisma = { user: { findUnique: vi.fn() } };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [
        { provide: CategoriesService, useValue: service },
        { provide: AuthTokenService, useValue: tokens },
        { provide: PrismaService, useValue: prisma },
        JwtAuthGuard,
        ActiveUserGuard,
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(() => {
    vi.resetAllMocks();
    tokens.verifyAccessToken.mockResolvedValue({
      sub: 'participant',
      sid: 'session',
    });
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    service.create.mockResolvedValue({ id });
    service.findAll.mockResolvedValue({ items: [], nextCursor: null });
    service.update.mockResolvedValue({ id });
  });

  afterAll(async () => {
    await app.close();
  });

  it('authenticates the author and normalizes names', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer token')
      .send(valid)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      'participant',
      expect.objectContaining({ tripId: id, name: '名前' }),
    );
  });

  it.each([
    {},
    { tripId: id, name: '' },
    { tripId: id, name: null },
    { tripId: id, name: '有効', description: null },
    { tripId: 'invalid', name: '有効' },
    { tripId: id, name: '有効', description: 'あ'.repeat(2001) },
    { tripId: id, name: '有効', extra: true },
  ])('rejects invalid create payloads %o', async (body) => {
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it.each([
    { name: null },
    { description: null },
    { tripId: id },
    { name: 'あ'.repeat(101) },
  ])('rejects invalid patch payloads %o', async (body) => {
    await request(app.getHttpServer())
      .patch('/categories/' + id)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('requires a valid JWT', async () => {
    await request(app.getHttpServer())
      .post('/categories')
      .send(valid)
      .expect(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('requires completed onboarding', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
    await request(app.getHttpServer())
      .post('/categories')
      .set('Authorization', 'Bearer token')
      .send(valid)
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rejects invalid path UUIDs', async () => {
    await request(app.getHttpServer())
      .get('/categories/invalid')
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('provides pagination defaults and accepts an explicit limit', async () => {
    await request(app.getHttpServer())
      .get('/categories')
      .query({ tripId: id })
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith(
      'participant',
      expect.objectContaining({ limit: 20 }),
    );
    await request(app.getHttpServer())
      .get('/categories')
      .query({ tripId: id, limit: 2 })
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(service.findAll).toHaveBeenLastCalledWith(
      'participant',
      expect.objectContaining({ limit: 2 }),
    );
  });

  it.each([0, 101, -1, '1.5', 'abc'])(
    'rejects invalid page limits %s',
    async (limit) => {
      await request(app.getHttpServer())
        .get('/categories')
        .query({ tripId: id, limit })
        .set('Authorization', 'Bearer token')
        .expect(400);
      expect(service.findAll).not.toHaveBeenCalled();
    },
  );

  it('requires the parent scope for listing', async () => {
    await request(app.getHttpServer())
      .get('/categories')
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.findAll).not.toHaveBeenCalled();
  });

  it('does not expose a delete route', async () => {
    await request(app.getHttpServer())
      .delete('/categories/' + id)
      .set('Authorization', 'Bearer token')
      .expect(404);
  });
});
