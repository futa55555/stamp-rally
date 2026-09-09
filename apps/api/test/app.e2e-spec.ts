import { Test } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';

describe('Application bootstrap (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('exposes health and protects domain routes', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ health: 'ok' });
    for (const path of [
      '/trips',
      '/genres',
      '/stamps',
      '/posts',
      '/uploads/batches/00000000-0000-4000-8000-000000000001',
      '/posts/00000000-0000-4000-8000-000000000001/original',
      '/invitations',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
  });

  it.each(['get', 'post'] as const)(
    'returns 404 for %s /comments',
    async (method) => {
      await request(app.getHttpServer())[method]('/comments').expect(404);
    },
  );

  afterAll(async () => {
    await app?.close();
  });
});
