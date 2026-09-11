import { BadRequestException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { AuthTokenService } from '../auth/auth-token/auth-token.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { TripTemplatesController } from './trip-templates.controller.js';
import { TripTemplatesService } from './trip-templates.service.js';

describe('TripTemplatesController', () => {
  let app: INestApplication;
  const service = { catalog: vi.fn(), preview: vi.fn() };
  const tokens = { verifyAccessToken: vi.fn() };
  const prisma = { user: { findUnique: vi.fn() } };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TripTemplatesController],
      providers: [
        { provide: TripTemplatesService, useValue: service },
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
    tokens.verifyAccessToken.mockResolvedValue({ sub: 'user', sid: 'session' });
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });
    service.catalog.mockReturnValue({
      locations: [{ name: '沖縄県', aliases: ['沖縄'] }],
      activities: [{ name: '海' }],
    });
    service.preview.mockReturnValue({ genres: [] });
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists presets for an authenticated active user', async () => {
    const response = await request(app.getHttpServer())
      .get('/trip-templates/presets')
      .set('Authorization', 'Bearer token')
      .expect(200);
    expect(response.body).toEqual(service.catalog.mock.results[0].value);
  });

  it('returns preview with status 200 and trims input like trip creation', async () => {
    await request(app.getHttpServer())
      .post('/trip-templates/preview')
      .set('Authorization', 'Bearer token')
      .send({ locations: [' 沖縄 ', ''], activityPresets: [' 海 ', ' '] })
      .expect(200, { genres: [] });
    expect(service.preview).toHaveBeenCalledWith({
      locations: ['沖縄'],
      activityPresets: ['海'],
    });
  });

  it('accepts no preset input or empty arrays', async () => {
    for (const body of [{}, { locations: [], activityPresets: [] }]) {
      await request(app.getHttpServer())
        .post('/trip-templates/preview')
        .set('Authorization', 'Bearer token')
        .send(body)
        .expect(200, { genres: [] });
    }
  });

  it.each([
    { locations: null },
    { locations: '沖縄県' },
    { locations: [1] },
    { locations: [['沖縄県']] },
    { locations: [{}] },
    { activityPresets: null },
    { activityPresets: '海' },
    { activityPresets: [null] },
    { activityPresets: [false] },
    { activityPresets: [['海']] },
    { activityPresets: ['あ'.repeat(101)] },
    { customActivities: ['海'] },
    { unknown: true },
  ])('rejects invalid payloads and unknown fields: %o', async (body) => {
    await request(app.getHttpServer())
      .post('/trip-templates/preview')
      .set('Authorization', 'Bearer token')
      .send(body)
      .expect(400);
    expect(service.preview).not.toHaveBeenCalled();
  });

  it('rejects unknown catalog query fields', async () => {
    await request(app.getHttpServer())
      .get('/trip-templates/presets')
      .query({ extra: true })
      .set('Authorization', 'Bearer token')
      .expect(400);
    expect(service.catalog).not.toHaveBeenCalled();
  });

  it('returns a bad request for unknown selected activities', async () => {
    service.preview.mockImplementation(() => {
      throw new BadRequestException('Unknown activity preset: unknown');
    });
    await request(app.getHttpServer())
      .post('/trip-templates/preview')
      .set('Authorization', 'Bearer token')
      .send({ activityPresets: ['unknown'] })
      .expect(400);
  });

  it.each(['presets', 'preview'])(
    'requires authentication for %s',
    async (route) => {
      const call = request(app.getHttpServer());
      await (
        route === 'presets'
          ? call.get('/trip-templates/presets')
          : call.post('/trip-templates/preview').send({})
      ).expect(401);
      expect(service.catalog).not.toHaveBeenCalled();
      expect(service.preview).not.toHaveBeenCalled();
    },
  );

  it.each(['presets', 'preview'])(
    'requires completed onboarding for %s',
    async (route) => {
      prisma.user.findUnique.mockResolvedValue({ status: 'ONBOARDING' });
      const call = request(app.getHttpServer());
      await (
        route === 'presets'
          ? call.get('/trip-templates/presets')
          : call.post('/trip-templates/preview').send({})
      )
        .set('Authorization', 'Bearer token')
        .expect(403);
      expect(service.catalog).not.toHaveBeenCalled();
      expect(service.preview).not.toHaveBeenCalled();
    },
  );
});
