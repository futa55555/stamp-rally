import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { TripInvitationsController } from './trip-invitations.controller.js';

const tripId = '00000000-0000-4000-8000-000000000001';
const invitationId = '00000000-0000-4000-8000-000000000002';

describe('Invitation controllers', () => {
  let app: INestApplication;
  const service = {
    create: vi.fn(),
    listForTrip: vi.fn(),
    listReceived: vi.fn(),
    decide: vi.fn(),
  };
  const prisma = { user: { findUnique: vi.fn() } };
  const token = { verifyAccessToken: vi.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InvitationsController, TripInvitationsController],
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
      sub: 'recipient',
      sid: 'session',
    });
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
  });

  afterAll(async () => app.close());

  it('requires authentication and completed onboarding', async () => {
    await request(app.getHttpServer()).get('/invitations').expect(401);
    prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
    await request(app.getHttpServer())
      .get('/invitations')
      .set('Authorization', 'Bearer token')
      .expect(403);
    expect(service.listReceived).not.toHaveBeenCalled();
  });

  it('accepts a trimmed name and derives the inviter from authentication', async () => {
    service.create.mockResolvedValue({ id: invitationId });
    await request(app.getHttpServer())
      .post(`/trips/${tripId}/invitations`)
      .set('Authorization', 'Bearer token')
      .send({ inviteeName: '  招待先  ' })
      .expect(201);
    expect(service.create).toHaveBeenCalledWith('recipient', tripId, {
      inviteeName: '招待先',
    });
  });

  it.each([
    {},
    { inviteeName: null },
    { inviteeName: ' ' },
    { inviteeName: 'あ'.repeat(21) },
    { inviteeName: 'Futa', invitedById: 'other' },
  ])('rejects invalid invitation input: %o', async (body) => {
    await request(app.getHttpServer())
      .post(`/trips/${tripId}/invitations`)
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('validates UUID route parameters and pagination', async () => {
    await request(app.getHttpServer())
      .post('/invitations/invalid/accept')
      .set('Authorization', 'Bearer token')
      .expect(400);
    await request(app.getHttpServer())
      .get('/invitations?limit=101')
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.decide).not.toHaveBeenCalled();
    expect(service.listReceived).not.toHaveBeenCalled();
  });

  it.each([
    ['accept', 'ACCEPTED'],
    ['decline', 'DECLINED'],
  ])('responds to %s with HTTP 200', async (action, status) => {
    service.decide.mockResolvedValue({ id: invitationId, status });
    await request(app.getHttpServer())
      .post(`/invitations/${invitationId}/${action}`)
      .set('Authorization', 'Bearer token')
      .expect(200)
      .expect({ id: invitationId, status });
    expect(service.decide).toHaveBeenCalledWith(
      'recipient',
      invitationId,
      status,
    );
  });
});
