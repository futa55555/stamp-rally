import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { InvitationWebController } from './invitation-web.controller.js';
import { PrismaService } from '../database/prisma.service.js';
import { createHash } from 'node:crypto';

describe('Public invitation website', () => {
  let app: INestApplication;
  const values: Record<string, string> = {
    INVITATION_PUBLIC_ORIGIN: 'https://invite.example.com',
    INVITATION_IOS_APP_ID: 'TEAM123456.com.futa.stamprally',
    INVITATION_ANDROID_PACKAGE: 'com.futa.stamprally',
    INVITATION_ANDROID_SHA256: Array(32).fill('AB').join(':'),
    INVITATION_APP_SCHEME: 'stamp-rally',
    INVITATION_IOS_INSTALL_URL: 'https://apps.apple.com/app/id123',
    INVITATION_ANDROID_INSTALL_URL:
      'https://play.google.com/store/apps/details?id=com.futa.stamprally',
  };
  const findUnique = vi.fn();
  const token = 'a'.repeat(43);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [InvitationWebController],
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (key: string) => values[key] },
        },
        {
          provide: PrismaService,
          useValue: { invitationLink: { findUnique } },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => app.close());
  beforeEach(() =>
    findUnique
      .mockReset()
      .mockResolvedValue({
        expiresAt: new Date(Date.now() + 60000),
        revokedAt: null,
      }),
  );
  it('serves association JSON without authentication or redirects, scoped to invite paths', async () => {
    const apple = await request(app.getHttpServer())
      .get('/.well-known/apple-app-site-association')
      .set('Host', 'invite.example.com')
      .expect(200);
    expect(apple.headers['content-type']).toContain('application/json');
    expect(apple.body.applinks.details[0]).toEqual({
      appIDs: [values.INVITATION_IOS_APP_ID],
      components: [{ '/': '/invite/*' }],
    });
    const android = await request(app.getHttpServer())
      .get('/.well-known/assetlinks.json')
      .set('Host', 'invite.example.com')
      .expect(200);
    expect(android.body[0].target).toMatchObject({
      package_name: 'com.futa.stamprally',
      sha256_cert_fingerprints: [values.INVITATION_ANDROID_SHA256],
    });
    expect(findUnique).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .get('/.well-known/assetlinks.json')
      .set('Host', 'wrong.example.com')
      .expect(503);
  });
  it('serves install/reopen guidance without exposing trip data or creating a request', async () => {
    const result = await request(app.getHttpServer())
      .get('/invite/' + token)
      .set('Host', 'invite.example.com')
      .expect(200);
    expect(result.text).toContain('この招待リンクをもう一度開く');
    expect(result.text).toContain('stamp-rally://invite/' + token);
    expect(result.headers['referrer-policy']).toBe('no-referrer');
    expect(result.headers['cache-control']).toBe('no-store');
    expect(findUnique).toHaveBeenCalledWith({
      where: { tokenHash: createHash('sha256').update(token).digest('hex') },
      select: { expiresAt: true, revokedAt: true },
    });
  });
  it('provides a useful unavailable page for expired, revoked, and malformed links', async () => {
    findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() - 1),
      revokedAt: null,
    });
    const expired = await request(app.getHttpServer())
      .get('/invite/' + token)
      .set('Host', 'invite.example.com')
      .expect(410);
    expect(expired.text).toContain('すでに申請済み');
    expect(expired.text).not.toContain('stamp-rally://');
    findUnique.mockResolvedValueOnce({
      expiresAt: new Date(Date.now() + 60000),
      revokedAt: new Date(),
    });
    await request(app.getHttpServer())
      .get('/invite/' + token)
      .set('Host', 'invite.example.com')
      .expect(410);
    findUnique.mockClear();
    await request(app.getHttpServer())
      .get('/invite/invalid')
      .set('Host', 'invite.example.com')
      .expect(404);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
