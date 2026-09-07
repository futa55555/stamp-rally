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
      '/comments',
      '/invitations',
    ]) {
      await request(app.getHttpServer()).get(path).expect(401);
    }
  });

  afterAll(async () => {
    await app?.close();
  });
});
