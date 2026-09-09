import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createHash } from 'node:crypto';
import { PublicInvitationLinksController } from './public-invitation-links.controller.js';
import { InvitationRepository } from './invitation.repository.js';
import { InvitationsService } from './invitations.service.js';
import type { PrismaService } from '../database/prisma.service.js';
import type { CoverPresenter } from '../covers/cover-presenter.service.js';
import { enablePublicWebCors } from '../common/public-web-cors.js';

describe('Public invitation status', () => {
  let app: INestApplication;
  const findUnique = vi.fn();
  const token = 'a'.repeat(43);
  const path = '/public/invitation-links/status';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PublicInvitationLinksController],
      providers: [
        {
          provide: InvitationsService,
          useValue: new InvitationRepository(
            { invitationLink: { findUnique } } as unknown as PrismaService,
            {} as CoverPresenter,
          ),
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    enablePublicWebCors(app, 'https://invite.example.com');
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() => {
    findUnique.mockReset();
  });

  it.each([
    ['ACTIVE', { expiresAt: new Date(Date.now() + 60000), revokedAt: null }],
    ['EXPIRED', { expiresAt: new Date(0), revokedAt: null }],
    ['REVOKED', { expiresAt: new Date(0), revokedAt: new Date() }],
    ['NOT_FOUND', null],
  ])(
    'returns only %s, without authentication or writes',
    async (status, link) => {
      findUnique.mockResolvedValue(link);
      const result = await request(app.getHttpServer())
        .post(path)
        .send({ token })
        .expect(200);
      expect(result.body).toEqual({ status });
      expect(result.headers['cache-control']).toBe('no-store');
      expect(findUnique).toHaveBeenCalledExactlyOnceWith({
        where: { tokenHash: createHash('sha256').update(token).digest('hex') },
        select: { expiresAt: true, revokedAt: true },
      });
    },
  );
  it('treats malformed tokens as missing without querying the database', async () => {
    for (const token of ['', 'short', 'x'.repeat(44), '/'.repeat(43)]) {
      const result = await request(app.getHttpServer())
        .post(path)
        .send({ token })
        .expect(200);
      expect(result.body).toEqual({ status: 'NOT_FOUND' });
    }
    expect(findUnique).not.toHaveBeenCalled();
  });
  it.each([
    {},
    { token: 123 },
    { token: 'a'.repeat(513) },
    { token, tripId: 'private' },
  ])('validates the request envelope %o', async (body) => {
    await request(app.getHttpServer()).post(path).send(body).expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });
  it('does not misreport an unavailable database as an invalid link', async () => {
    findUnique.mockRejectedValue(new Error('Unavailable'));
    const result = await request(app.getHttpServer())
      .post(path)
      .send({ token })
      .expect(500);
    expect(result.body).not.toHaveProperty('status');
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('permits only the configured web origin and the status POST preflight', async () => {
    const preflight = await request(app.getHttpServer())
      .options(path)
      .set('Origin', 'https://invite.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);
    expect(preflight.headers['access-control-allow-origin']).toBe(
      'https://invite.example.com',
    );
    expect(preflight.headers['access-control-allow-methods']).toBe('POST');
    expect(preflight.headers['access-control-allow-headers']).toBe(
      'Content-Type',
    );
    expect(
      preflight.headers['access-control-allow-credentials'],
    ).toBeUndefined();
    findUnique.mockResolvedValue(null);
    for (const origin of [
      'https://invite.example.com',
      'https://untrusted.example.com',
    ]) {
      const result = await request(app.getHttpServer())
        .post(path)
        .set('Origin', origin)
        .send({ token })
        .expect(200);
      expect(result.headers['access-control-allow-origin']).toBe(
        origin.includes('untrusted') ? undefined : origin,
      );
    }
  });
  it('leaves public HTML and association assets to Pages', async () => {
    for (const route of [
      '/invite/' + token,
      '/.well-known/apple-app-site-association',
      '/.well-known/assetlinks.json',
    ])
      await request(app.getHttpServer()).get(route).expect(404);
  });
});
