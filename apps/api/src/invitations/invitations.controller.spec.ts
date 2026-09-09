import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { TripInvitationsController } from './trip-invitations.controller.js';
import { InvitationLinksController } from './invitation-links.controller.js';

const id = '00000000-0000-4000-8000-000000000001';
const validToken = 'a'.repeat(43);
describe('Invitation controllers', () => {
  let app: INestApplication;
  const service = {
    createLink: vi.fn(),
    listLinks: vi.fn(),
    preview: vi.fn(),
    previewReceived: vi.fn(),
    requestReceived: vi.fn(),
    revokeLink: vi.fn(),
    request: vi.fn(),
    listForTrip: vi.fn(),
    listReceived: vi.fn(),
    decide: vi.fn(),
    detail: vi.fn(),
  };
  const prisma = { user: { findUnique: vi.fn() } };
  const token = { verifyAccessToken: vi.fn() };
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        InvitationsController,
        TripInvitationsController,
        InvitationLinksController,
      ],
      providers: [
        { provide: InvitationsService, useValue: service },
        { provide: AuthTokenService, useValue: token },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    vi.resetAllMocks();
    token.verifyAccessToken.mockResolvedValue({
      sub: 'viewer',
      sid: 'session',
    });
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
  });
  afterAll(async () => app.close());

  it('requires authentication and onboarding', async () => {
    await request(app.getHttpServer()).get('/invitations').expect(401);
    prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
    await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', 'Bearer token')
      .send({ token: validToken })
      .expect(403);
    expect(service.request).not.toHaveBeenCalled();
  });
  it('uses the authenticated applicant and removes name-based issuance', async () => {
    await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', 'Bearer token')
      .send({ token: validToken })
      .expect(201);
    expect(service.request).toHaveBeenCalledWith(validToken, 'viewer');
    await request(app.getHttpServer())
      .post('/trips/' + id + '/invitations')
      .set('Authorization', 'Bearer token')
      .send({ inviteeName: 'name' })
      .expect(404);
  });
  it('authenticates receipt lookup and application and uses the signed-in recipient', async () => {
    for (const [method, path, operation, status] of [
      ['get', '/invitation-links/' + id, service.previewReceived, 200],
      [
        'post',
        '/invitation-links/' + id + '/request',
        service.requestReceived,
        201,
      ],
    ] as const) {
      await request(app.getHttpServer())[method](path).expect(401);
      prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', 'Bearer token')
        .expect(403);
      prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
      await request(app.getHttpServer())
        [method](path.replace(id, 'invalid'))
        .set('Authorization', 'Bearer token')
        .expect(400);
      expect(operation).not.toHaveBeenCalled();
      await request(app.getHttpServer())
        [method](path)
        .set('Authorization', 'Bearer token')
        .expect(status);
      expect(operation).toHaveBeenCalledWith(id, 'viewer');
    }
  });
  it.each([
    {},
    { token: '' },
    { token: 'a'.repeat(42) },
    { token: validToken, inviteeId: id },
  ])('rejects invalid request %o', async (body) => {
    await request(app.getHttpServer())
      .post('/invitations')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.request).not.toHaveBeenCalled();
  });
  it.each(['confirm', 'decline', 'cancel'])(
    'requires a generation for %s and returns 200',
    async (action) => {
      const url = '/invitations/' + id + '/' + action;
      for (const body of [
        {},
        { generation: 0 },
        { generation: '1' },
        { generation: 1, userId: id },
      ])
        await request(app.getHttpServer())
          .post(url)
          .set('Authorization', 'Bearer token')
          .send(body)
          .expect(400);
      await request(app.getHttpServer())
        .post(url)
        .set('Authorization', 'Bearer token')
        .send({ generation: 1 })
        .expect(200);
      expect(service.decide).toHaveBeenCalledWith(id, 'viewer', action, 1);
    },
  );
  it('validates filters and identifiers', async () => {
    for (const path of [
      '/invitations?view=all',
      '/invitations?limit=101',
      '/invitations/invalid',
    ])
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer token')
        .expect(400);
    await request(app.getHttpServer())
      .get('/invitations?view=review')
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(service.listReceived).toHaveBeenCalledWith(
      'viewer',
      expect.objectContaining({ view: 'review' }),
    );
  });
});
