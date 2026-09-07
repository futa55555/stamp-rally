import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';

describe('TripsController', () => {
  let app: INestApplication;
  const id = '31fc6c40-7810-4b31-9d59-8b7042479410';
  const valid = {
    name: '  旅行  ',
    startDate: '2026-09-07',
    endDate: '2026-09-10',
    inviteeNames: ['  友達  '],
  };
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
      controllers: [TripsController],
      providers: [
        { provide: TripsService, useValue: service },
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
      .post('/trips')
      .set('Authorization', 'Bearer token')
      .send(valid)
      .expect(201);
    expect(service.create).toHaveBeenCalledWith(
      'participant',
      expect.objectContaining({ name: '旅行', inviteeNames: ['友達'] }),
    );
  });

  it.each([
    {},
    { ...valid, startDate: '2026-02-29' },
    { ...valid, endDate: '2026-04-31' },
    { ...valid, startDate: '2026-09-07T00:00:00Z' },
    { ...valid, endDate: null },
    { ...valid, name: null },
    { ...valid, coverImageUrl: 'http://example.com/image.jpg' },
    { ...valid, inviteeNames: null },
    { ...valid, inviteeNames: [''] },
    { ...valid, inviteeNames: ['あ'.repeat(21)] },
    { ...valid, extra: true },
  ])('rejects invalid create payloads %o', async (body) => {
    await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it.each([
    { name: null },
    { startDate: null },
    { endDate: '2026-02-29' },
    { inviteeNames: ['友達'] },
  ])('rejects invalid patch payloads %o', async (body) => {
    await request(app.getHttpServer())
      .patch('/trips/' + id)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it('requires a valid JWT', async () => {
    await request(app.getHttpServer()).post('/trips').send(valid).expect(401);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('requires completed onboarding', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
    await request(app.getHttpServer())
      .post('/trips')
      .set('Authorization', 'Bearer token')
      .send(valid)
      .expect(403);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('rejects invalid path UUIDs', async () => {
    await request(app.getHttpServer())
      .get('/trips/invalid')
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.findOne).not.toHaveBeenCalled();
  });

  it('provides pagination defaults and accepts an explicit limit', async () => {
    await request(app.getHttpServer())
      .get('/trips')
      .query({})
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(service.findAll).toHaveBeenCalledWith(
      'participant',
      expect.objectContaining({ limit: 20 }),
    );
    await request(app.getHttpServer())
      .get('/trips')
      .query({ limit: 2 })
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
        .get('/trips')
        .query({ limit })
        .set('Authorization', 'Bearer token')
        .expect(400);
      expect(service.findAll).not.toHaveBeenCalled();
    },
  );

  it('accepts an explicit null to clear the cover', async () => {
    await request(app.getHttpServer())
      .patch('/trips/' + id)
      .set('Authorization', 'Bearer token')
      .send({ coverImageUrl: null })
      .expect(200);
    expect(service.update).toHaveBeenCalledWith(
      'participant',
      id,
      expect.objectContaining({ coverImageUrl: null }),
    );
  });

  it('does not expose a delete route', async () => {
    await request(app.getHttpServer())
      .delete('/trips/' + id)
      .set('Authorization', 'Bearer token')
      .expect(404);
  });
});
