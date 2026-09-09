import { CoverAssetsService } from '../src/covers/cover-assets.service.js';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthTokenService } from '../src/auth/auth-token/auth-token.service.js';
import { PrismaService } from '../src/database/prisma.service.js';
import { ObjectStorageService } from '../src/storage/object-storage.service.js';
import { MediaProcessor } from '../src/media-processing/media-processor.service.js';
import { MediaQueue } from '../src/media-processing/media-queue.service.js';
import { UploadLifecycleService } from '../src/uploads/upload-lifecycle.service.js';
import {
  TestMediaProcessor,
  TestMediaQueue,
  TestObjectStorage,
} from './media-fixtures.js';

interface Actor {
  id: string;
  name: string;
  accessToken: string;
}

interface Resource {
  id: string;
  locations: string[];
  readAt: string | null;
  hasUnreadPhotos: boolean;
  photoCount: number;
  name: string;
  description: string;
  isCompleted: boolean;
  tripId: string;
  genreId: string;
  stampId: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  totalGenreCount: number;
  completedGenreCount: number;
  totalStampCount: number;
  completedStampCount: number;
  isFavorite: boolean;
  author: { id: string; name: string };
}

interface Page<T = Resource> {
  items: T[];
  nextCursor: string | null;
}

type Method = 'get' | 'post' | 'patch' | 'delete';
type Input = Record<string, unknown>;
type Query = Record<string, string | number | boolean>;
const tripInput = {
  name: '  秋の旅  ',
  startDate: '2026-09-07',
  endDate: '2026-09-09',
};
const mediaInput = {
  mediaType: 'IMAGE',
  mediaUrl: 'https://example.com/photo.jpg',
};

describe('Trip API integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokens: AuthTokenService;
  let owner: Actor;
  let member: Actor;
  let outsider: Actor;
  let lifecycle: UploadLifecycleService;
  const storage = new TestObjectStorage();
  const queue = new TestMediaQueue();

  async function cleanDatabase() {
    await prisma.trip.deleteMany();
    await prisma.uploadBatch.deleteMany();
    await prisma.coverAsset.deleteMany();
    await prisma.mediaCleanup.deleteMany();
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  async function actor(
    name: string,
    status: 'ACTIVE' | 'ONBOARDING' = 'ACTIVE',
  ): Promise<Actor> {
    const user = await prisma.user.create({
      data: { name: status === 'ACTIVE' ? name : null, status },
    });
    const session = await prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: randomBytes(32).toString('hex'),
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    return {
      id: user.id,
      name,
      accessToken: await tokens.signAccessToken(user.id, session.id),
    };
  }

  async function http<T = Resource>(
    method: Method,
    path: string,
    who: Actor | null,
    body?: Input,
    status = method === 'post' ? 201 : 200,
    query?: Query,
  ): Promise<T> {
    const call = request(app.getHttpServer())[method](path);
    if (who) call.set('Authorization', `Bearer ${who.accessToken}`);
    if (body !== undefined) call.send(body);
    if (query) call.query(query);
    const response = await call.expect(status);
    return response.body as T;
  }

  function get<T = Resource>(path: string, who: Actor, query?: Query) {
    return http<T>('get', path, who, undefined, 200, query);
  }

  // Fixtures follow the upload API and real publication transaction; only S3
  // and encoding are replaced. The legacy URL registration API stays rejected.
  async function publish(who: Actor, input: Input): Promise<Resource> {
    const video = input.mediaType === 'VIDEO';
    const batch = await http<{ id: string; uploads: Array<{ id: string }> }>(
      'post',
      '/uploads/batches',
      who,
      {
        stampId: input.stampId,
        clientRequestId: randomUUID(),
        files: [
          {
            clientId: randomUUID(),
            fileName: video ? 'video.mp4' : 'photo.jpg',
            mimeType: video ? 'video/mp4' : 'image/jpeg',
            byteSize: 100,
            mediaType: video ? 'VIDEO' : 'IMAGE',
          },
        ],
      },
    );
    const id = batch.uploads[0]!.id;
    const row = await prisma.post.findUniqueOrThrow({ where: { id } });
    if (video) {
      storage.multipart.get(row.multipartUploadId!)!.parts = [
        { partNumber: 1, etag: 'test-part', byteSize: 100 },
      ];
    } else {
      storage.objects.set(row.stagingKey!, {
        byteSize: 100,
        contentType: 'image/jpeg',
        etag: 'test-object',
      });
    }
    await http(
      'post',
      `/uploads/${id}/complete`,
      who,
      video ? { parts: [{ partNumber: 1, etag: 'test-part' }] } : {},
    );
    const processing = await prisma.post.findUniqueOrThrow({ where: { id } });
    await lifecycle.process(id, processing.processingVersion);
    return get(`/posts/${id}`, who);
  }

  async function cover(who = owner) {
    const upload = await http<{ id: string }>('post', '/uploads/covers', who, {
      clientRequestId: randomUUID(),
      byteSize: 100,
      mimeType: 'image/png',
    });
    const row = await prisma.coverAsset.findUniqueOrThrow({
      where: { id: upload.id },
    });
    storage.objects.set(row.stagingKey!, {
      byteSize: 100,
      contentType: 'image/png',
    });
    await http('post', `/uploads/covers/${row.id}/complete`, who, {});
    await app.get(CoverAssetsService).process(row.id);
    return row.id;
  }

  async function tree(who = owner) {
    const trip = await http('post', '/trips', who, tripInput);
    const genre = await http('post', '/genres', who, {
      tripId: trip.id,
      name: '  食事  ',
    });
    const stamp = await http('post', '/stamps', who, {
      genreId: genre.id,
      name: '  朝ごはん  ',
    });
    return { trip, genre, stamp };
  }

  async function join(tripId: string, invitee = member, inviter = owner) {
    const invitation = await http(
      'post',
      `/trips/${tripId}/invitations`,
      inviter,
      { inviteeName: invitee.name },
    );
    await http(
      'post',
      `/invitations/${invitation.id}/accept`,
      invitee,
      undefined,
      200,
    );
    return invitation;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ObjectStorageService)
      .useValue(storage)
      .overrideProvider(MediaProcessor)
      .useValue(new TestMediaProcessor(storage))
      .overrideProvider(MediaQueue)
      .useValue(queue)
      .compile();
    prisma = moduleRef.get(PrismaService);
    tokens = moduleRef.get(AuthTokenService);
    lifecycle = moduleRef.get(UploadLifecycleService);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await cleanDatabase();
    storage.reset();
    queue.jobs.length = 0;
    owner = await actor('Owner');
    member = await actor('Member');
    outsider = await actor('Outsider');
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  it('creates a private hierarchy with date-only periods and empty defaults', async () => {
    const { trip, genre, stamp } = await tree();

    expect(trip).toMatchObject({
      name: '秋の旅',
      startDate: '2026-09-07',
      endDate: '2026-09-09',
      coverImageUrl: null,
      totalGenreCount: 0,
      completedGenreCount: 0,
      isCompleted: false,
    });
    expect(genre).toMatchObject({
      name: '食事',
      description: '',
      tripId: trip.id,
      totalStampCount: 0,
      completedStampCount: 0,
      isCompleted: false,
    });
    expect(stamp).toMatchObject({
      name: '朝ごはん',
      description: '',
      genreId: genre.id,
      isCompleted: false,
    });
    const members = await get<
      Page<{ userId: string; user: { id: string; name: string } }>
    >(`/trips/${trip.id}/members`, owner);
    expect(members.items).toHaveLength(1);
    expect(members.items[0]).toMatchObject({
      userId: owner.id,
      user: { id: owner.id, name: 'Owner' },
    });
    expect((await get<Page>('/trips', outsider)).items).toEqual([]);
    const persisted = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(persisted.startDate.toISOString()).toBe('2026-09-07T00:00:00.000Z');
    expect(persisted.endDate.toISOString()).toBe('2026-09-09T00:00:00.000Z');
  });

  it('creates initial invitations atomically and hides content until acceptance', async () => {
    await http(
      'post',
      '/trips',
      owner,
      { ...tripInput, inviteeNames: ['Member', 'Missing'] },
      404,
    );
    await http(
      'post',
      '/trips',
      owner,
      { ...tripInput, inviteeNames: ['Member', 'Owner'] },
      409,
    );
    expect(await prisma.trip.count()).toBe(0);
    expect(await prisma.tripMember.count()).toBe(0);
    expect(await prisma.tripInvitation.count()).toBe(0);

    const trip = await http('post', '/trips', owner, {
      ...tripInput,
      inviteeNames: ['  Member  ', 'Member'],
    });
    const genre = await http('post', '/genres', owner, {
      tripId: trip.id,
      name: 'Genre',
    });
    const stamp = await http('post', '/stamps', owner, {
      genreId: genre.id,
      name: 'Stamp',
    });
    const pending = await get<
      Page<{ id: string; trip: Input; invitedBy: Input }>
    >('/invitations', member);
    expect(pending.items).toHaveLength(1);
    expect(pending.items[0].trip).toMatchObject({
      id: trip.id,
      name: '秋の旅',
      startDate: '2026-09-07',
      endDate: '2026-09-09',
      coverImageUrl: null,
    });
    expect(pending.items[0].invitedBy).toEqual({
      id: owner.id,
      name: owner.name,
    });
    expect((await get<Page>('/trips', member)).items).toEqual([]);
    for (const path of [
      `/trips/${trip.id}`,
      `/genres/${genre.id}`,
      `/stamps/${stamp.id}`,
      `/posts?stampId=${stamp.id}`,
    ]) {
      await http('get', path, member, undefined, 404);
    }
    await http(
      'post',
      `/invitations/${pending.items[0].id}/accept`,
      outsider,
      undefined,
      404,
    );
    await http(
      'post',
      `/invitations/${pending.items[0].id}/accept`,
      member,
      undefined,
      200,
    );
    expect(
      (await get<Page>('/trips', member)).items.map((item) => item.id),
    ).toEqual([trip.id]);
    expect((await get(`/stamps/${stamp.id}`, member)).id).toBe(stamp.id);
  });

  it('lets accepted members edit the hierarchy, add content, and invite others', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);

    await http('patch', `/trips/${trip.id}`, member, {
      name: '共同の旅',
      coverAssetId: await cover(member),
    });
    await http('patch', `/genres/${genre.id}`, member, {
      name: 'ごはん',
      description: '説明',
    });
    await http('patch', `/stamps/${stamp.id}`, member, {
      name: '朝食',
      description: '朝に集合',
    });
    const extraGenre = await http('post', '/genres', member, {
      tripId: trip.id,
      name: '景色',
    });
    await http('post', '/stamps', member, {
      genreId: extraGenre.id,
      name: '海',
    });
    await join(trip.id, outsider, member);
    const post = await publish(member, {
      stampId: stamp.id,
      ...mediaInput,
    });

    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: '共同の旅',
      coverImageUrl: expect.stringContaining('https://media.example.test/'),
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      name: 'ごはん',
      description: '説明',
    });
    expect(await get(`/stamps/${stamp.id}`, outsider)).toMatchObject({
      name: '朝食',
      description: '朝に集合',
    });
    expect(post).toMatchObject({
      tripId: trip.id,
      genreId: genre.id,
      stampId: stamp.id,
      isFavorite: false,
      author: { id: member.id, name: member.name },
    });
    expect(
      (await get<Page>(`/trips/${trip.id}/members`, outsider)).items,
    ).toHaveLength(3);
    expect(
      (await get<Page>('/posts', owner, { stampId: stamp.id })).items.map(
        (item) => item.id,
      ),
    ).toEqual([post.id]);
  });

  it('requires ACTIVE users on every domain route while retaining name-only onboarding', async () => {
    const onboarding = await actor('Newcomer', 'ONBOARDING');
    const { trip, genre, stamp } = await tree();
    const requests: [Method, string, Input?][] = [
      ['get', '/trips'],
      ['post', '/trips', tripInput],
      ['get', `/trips/${trip.id}/members`],
      ['get', `/genres?tripId=${trip.id}`],
      ['post', '/genres', { tripId: trip.id, name: 'Genre' }],
      ['get', `/stamps?genreId=${genre.id}`],
      ['post', '/stamps', { genreId: genre.id, name: 'Stamp' }],
      ['get', `/posts?stampId=${stamp.id}`],
      ['post', '/posts', { stampId: stamp.id, ...mediaInput }],
      [
        'post',
        '/uploads/batches',
        {
          stampId: stamp.id,
          files: [
            {
              clientId: 'auth-check',
              fileName: 'photo.jpg',
              mimeType: 'image/jpeg',
              mediaType: 'IMAGE',
              byteSize: 100,
            },
          ],
        },
      ],
      ['get', '/invitations'],
      ['post', `/trips/${trip.id}/invitations`, { inviteeName: 'Member' }],
    ];
    for (const [method, path, body] of requests) {
      await http(method, path, null, body, 401);
      await http(method, path, onboarding, body, 403);
    }
    expect(await get('/users/me', onboarding)).toMatchObject({
      id: onboarding.id,
      name: null,
      status: 'ONBOARDING',
    });
    await http('get', '/users/lookup?name=Owner', onboarding, undefined, 403);
    await http('patch', '/users/me', onboarding, { name: '  Newcomer  ' });
    expect(await get('/users/me', onboarding)).toMatchObject({
      name: 'Newcomer',
      status: 'ACTIVE',
    });
    await get('/trips', onboarding);
    await http(
      'patch',
      '/users/me',
      onboarding,
      { name: 'Newcomer', username: 'new' },
      400,
    );
  });

  it('denies cross-trip reads and writes for every resource, list scope, member and invitation route', async () => {
    const { trip, genre, stamp } = await tree();
    const foreign = await tree(outsider);
    const post = await publish(owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const invitation = await http(
      'post',
      `/trips/${trip.id}/invitations`,
      owner,
      { inviteeName: member.name },
    );
    const requests: [Method, string, Input?][] = [
      ['get', `/trips/${trip.id}`],
      ['patch', `/trips/${trip.id}`, { name: 'Intrusion' }],
      ['get', `/trips/${trip.id}/members`],
      ['get', `/trips/${trip.id}/invitations`],
      ['post', `/trips/${trip.id}/invitations`, { inviteeName: 'Outsider' }],
      ['get', `/genres?tripId=${trip.id}`],
      ['get', `/genres/${genre.id}`],
      ['post', '/genres', { tripId: trip.id, name: 'Intrusion' }],
      ['patch', `/genres/${genre.id}`, { name: 'Intrusion' }],
      ['get', `/stamps?genreId=${genre.id}`],
      ['get', `/stamps/${stamp.id}`],
      ['post', '/stamps', { genreId: genre.id, name: 'Intrusion' }],
      ['patch', `/stamps/${stamp.id}`, { name: 'Intrusion' }],
      ['get', `/posts/${post.id}`],
      ['get', `/posts?stampId=${stamp.id}`],
      ['get', `/posts?genreId=${genre.id}`],
      ['get', `/posts?tripId=${trip.id}`],
      ['get', `/posts?tripId=${trip.id}&favoritesOnly=true`],
      ['get', `/posts?genreId=${genre.id}&favoritesOnly=true`],
      ['get', `/posts?stampId=${stamp.id}&favoritesOnly=true`],
      ['post', '/posts', { stampId: stamp.id, ...mediaInput }],
      ['patch', `/posts/${post.id}/favorite`, { isFavorite: true }],
      ['post', `/invitations/${invitation.id}/accept`],
      ['post', `/invitations/${invitation.id}/decline`],
    ];
    for (const [method, path, body] of requests)
      await http(method, path, outsider, body, 404);

    expect(
      (await get<Page>('/trips', outsider)).items.map((item) => item.id),
    ).toEqual([foreign.trip.id]);
    expect((await get<Page>('/invitations', outsider)).items).toEqual([]);
    expect(await get(`/posts/${post.id}`, owner)).toMatchObject({
      isFavorite: false,
    });
    expect(
      (await get<Page>('/posts', owner, { stampId: stamp.id })).items.map(
        (item) => item.id,
      ),
    ).toEqual([post.id]);
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: '秋の旅',
      totalGenreCount: 1,
    });
  });

  it('rejects parent reassignment and caller-supplied author or identity fields', async () => {
    const { trip, genre, stamp } = await tree();
    const other = await tree();
    const post = await publish(owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const requests: [Method, string, Input][] = [
      ['patch', `/trips/${trip.id}`, { name: 'New', createdById: outsider.id }],
      ['patch', `/genres/${genre.id}`, { name: 'New', tripId: other.trip.id }],
      [
        'patch',
        `/stamps/${stamp.id}`,
        { name: 'New', genreId: other.genre.id },
      ],
      [
        'post',
        '/posts',
        { stampId: stamp.id, ...mediaInput, authorId: outsider.id },
      ],
      [
        'patch',
        `/posts/${post.id}/favorite`,
        { isFavorite: true, stampId: other.stamp.id },
      ],
    ];
    for (const [method, path, body] of requests)
      await http(method, path, owner, body, 400);
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      tripId: trip.id,
      name: '食事',
    });
    expect(await get(`/stamps/${stamp.id}`, owner)).toMatchObject({
      genreId: genre.id,
      name: '朝ごはん',
    });
    expect(await get(`/posts/${post.id}`, owner)).toMatchObject({
      stampId: stamp.id,
      isFavorite: false,
    });
  });

  it('derives progress from posts, updates ancestors after additions, and counts beyond pagination', async () => {
    const { trip, genre, stamp } = await tree();
    expect(await get(`/stamps/${stamp.id}`, owner)).toMatchObject({
      isCompleted: false,
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      totalStampCount: 1,
      completedStampCount: 0,
      isCompleted: false,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      totalGenreCount: 1,
      completedGenreCount: 0,
      isCompleted: false,
    });

    await publish(owner, { stampId: stamp.id, ...mediaInput });
    expect(await get(`/stamps/${stamp.id}`, owner)).toMatchObject({
      isCompleted: true,
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      totalStampCount: 1,
      completedStampCount: 1,
      isCompleted: true,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      totalGenreCount: 1,
      completedGenreCount: 1,
      isCompleted: true,
    });

    const nextStamp = await http('post', '/stamps', owner, {
      genreId: genre.id,
      name: '追加',
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      totalStampCount: 2,
      completedStampCount: 1,
      isCompleted: false,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      totalGenreCount: 1,
      completedGenreCount: 0,
      isCompleted: false,
    });
    await publish(owner, {
      stampId: nextStamp.id,
      mediaType: 'VIDEO',
      mediaUrl: 'https://example.com/video.mp4',
    });
    const emptyGenre = await http('post', '/genres', owner, {
      tripId: trip.id,
      name: '空のジャンル',
    });
    expect(await get(`/genres/${emptyGenre.id}`, owner)).toMatchObject({
      totalStampCount: 0,
      completedStampCount: 0,
      isCompleted: false,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      totalGenreCount: 2,
      completedGenreCount: 1,
      isCompleted: false,
    });
    const finalStamp = await http('post', '/stamps', owner, {
      genreId: emptyGenre.id,
      name: '最後',
    });
    await publish(owner, {
      stampId: finalStamp.id,
      ...mediaInput,
    });

    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      totalGenreCount: 2,
      completedGenreCount: 2,
      isCompleted: true,
    });
    const genres = await get<Page>('/genres', owner, {
      tripId: trip.id,
      limit: 1,
    });
    expect(genres.items).toHaveLength(1);
    expect(genres.items[0]).toMatchObject({
      id: genre.id,
      totalStampCount: 2,
      completedStampCount: 2,
      isCompleted: true,
    });
    expect(genres.nextCursor).toEqual(expect.any(String));
    expect(
      (await get<Page>('/stamps', owner, { genreId: genre.id, limit: 1 }))
        .items,
    ).toHaveLength(1);
    expect(
      (await get<Page>('/trips', owner, { limit: 1 })).items[0],
    ).toMatchObject({ totalGenreCount: 2, completedGenreCount: 2 });
  });

  it('shares explicit favorite state and scopes favorites to stamp, genre and trip', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);
    const first = await publish(owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const second = await publish(member, {
      stampId: stamp.id,
      ...mediaInput,
      mediaUrl: 'https://example.com/second.jpg',
    });
    const foreign = await tree(outsider);
    const foreignPost = await publish(outsider, {
      stampId: foreign.stamp.id,
      ...mediaInput,
    });
    await http('patch', `/posts/${foreignPost.id}/favorite`, outsider, {
      isFavorite: true,
    });
    await http('patch', `/posts/${first.id}/favorite`, member, {
      isFavorite: true,
    });
    await http('patch', `/posts/${first.id}/favorite`, member, {
      isFavorite: true,
    });

    const scopes: Query[] = [
      { stampId: stamp.id },
      { genreId: genre.id },
      { tripId: trip.id },
    ];
    for (const scope of scopes) {
      const all = await get<Page>('/posts', owner, {
        ...scope,
        favoritesOnly: false,
      });
      expect(new Set(all.items.map((item) => item.id))).toEqual(
        new Set([first.id, second.id]),
      );
      const favorite = await get<Page>('/posts', owner, {
        ...scope,
        favoritesOnly: true,
      });
      expect(favorite.items.map((item) => item.id)).toEqual([first.id]);
      expect(favorite.items[0]).toMatchObject({
        tripId: trip.id,
        genreId: genre.id,
        stampId: stamp.id,
        isFavorite: true,
      });
    }
    await http('patch', `/posts/${first.id}/favorite`, owner, {
      isFavorite: false,
    });
    expect(
      (
        await get<Page>('/posts', member, {
          tripId: trip.id,
          favoritesOnly: true,
        })
      ).items,
    ).toEqual([]);
    expect((await get(`/stamps/${stamp.id}`, member)).isCompleted).toBe(true);
  });

  it('accepts leap days, same-day periods and partial date updates, and clears the cover explicitly', async () => {
    const trip = await http('post', '/trips', owner, {
      name: 'Leap day',
      startDate: '2028-02-29',
      endDate: '2028-02-29',
      coverAssetId: null,
    });
    expect(trip).toMatchObject({
      startDate: '2028-02-29',
      endDate: '2028-02-29',
      coverImageUrl: null,
    });
    await http('patch', `/trips/${trip.id}`, owner, {
      endDate: '2028-03-01',
      coverAssetId: await cover(),
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      startDate: '2028-02-29',
      endDate: '2028-03-01',
    });
    await http('patch', `/trips/${trip.id}`, owner, {
      startDate: '2028-03-01',
      coverAssetId: null,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      startDate: '2028-03-01',
      endDate: '2028-03-01',
      coverImageUrl: null,
    });
    await http(
      'patch',
      `/trips/${trip.id}`,
      owner,
      { startDate: '2028-03-02' },
      400,
    );
    await http(
      'patch',
      `/trips/${trip.id}`,
      owner,
      { endDate: '2028-02-29' },
      400,
    );
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      startDate: '2028-03-01',
      endDate: '2028-03-01',
    });
  });

  it('serializes concurrent partial trip updates to preserve valid periods and disjoint fields', async () => {
    const trip = await http('post', '/trips', owner, tripInput);
    const results = await Promise.all([
      request(app.getHttpServer())
        .patch(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ startDate: '2026-09-09' }),
      request(app.getHttpServer())
        .patch(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ endDate: '2026-09-08' }),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 400]);
    const persisted = await get(`/trips/${trip.id}`, owner);
    expect(persisted.startDate <= persisted.endDate).toBe(true);

    await Promise.all([
      http('patch', `/trips/${trip.id}`, owner, { name: 'Concurrent name' }),
      http('patch', `/trips/${trip.id}`, owner, {
        coverAssetId: await cover(),
      }),
    ]);
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: 'Concurrent name',
      coverImageUrl: expect.stringContaining('https://media.example.test/'),
      startDate: persisted.startDate,
      endDate: persisted.endDate,
    });
  });

  it.each([
    { startDate: null },
    { endDate: null },
    { startDate: '2026-02-29' },
    { startDate: '2026-04-31' },
    { startDate: '2026-9-07' },
    { startDate: '2026-09-07T00:00:00Z' },
    { endDate: '2026-09-06' },
    { name: null },
    { name: ' ' },
    { coverImageUrl: 'http://example.com/cover.jpg' },
    { inviteeNames: null },
  ])(
    'rejects invalid trip creation without writing rows: %o',
    async (invalid) => {
      await http('post', '/trips', owner, { ...tripInput, ...invalid }, 400);
      expect(await prisma.trip.count()).toBe(0);
    },
  );

  it('strictly validates partial updates, text, media and favorite state', async () => {
    const { trip, genre, stamp } = await tree();
    const post = await publish(owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const invalidRequests: [Method, string, Input][] = [
      ['patch', `/trips/${trip.id}`, {}],
      ['patch', `/trips/${trip.id}`, { name: null }],
      ['patch', `/trips/${trip.id}`, { startDate: null }],
      ['patch', `/trips/${trip.id}`, { endDate: null }],
      ['patch', `/trips/${trip.id}`, { endDate: '2026-02-29' }],
      [
        'post',
        '/genres',
        { tripId: trip.id, name: 'Genre', description: null },
      ],
      ['patch', `/genres/${genre.id}`, {}],
      ['patch', `/genres/${genre.id}`, { name: null }],
      ['patch', `/genres/${genre.id}`, { description: null }],
      [
        'post',
        '/stamps',
        { genreId: genre.id, name: 'Stamp', description: 'x'.repeat(2001) },
      ],
      ['patch', `/stamps/${stamp.id}`, {}],
      ['patch', `/stamps/${stamp.id}`, { name: ' ' }],
      ['patch', `/stamps/${stamp.id}`, { description: null }],
      ['post', '/posts', { stampId: stamp.id }],
      [
        'post',
        '/posts',
        {
          stampId: stamp.id,
          mediaType: 'AUDIO',
          mediaUrl: mediaInput.mediaUrl,
        },
      ],
      ['post', '/posts', { stampId: stamp.id, ...mediaInput, mediaUrl: null }],
      [
        'post',
        '/posts',
        {
          stampId: stamp.id,
          ...mediaInput,
          mediaUrl: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
        },
      ],
      [
        'post',
        '/posts',
        {
          stampId: stamp.id,
          ...mediaInput,
          mediaUrl: 'http://example.com/image.jpg',
        },
      ],
      [
        'post',
        '/posts',
        { stampId: stamp.id, ...mediaInput, isFavorite: true },
      ],
      ['patch', `/posts/${post.id}/favorite`, {}],
      ['patch', `/posts/${post.id}/favorite`, { isFavorite: null }],
      ['patch', `/posts/${post.id}/favorite`, { isFavorite: 'true' }],
    ];
    for (const [method, path, body] of invalidRequests)
      await http(method, path, owner, body, 400);
    expect(await prisma.post.count()).toBe(1);
  });

  it('rejects invalid, ambiguous or missing list scopes and malformed UUIDs and cursors', async () => {
    const { trip, genre, stamp } = await tree();
    for (const path of [
      '/posts',
      `/posts?tripId=${trip.id}&genreId=${genre.id}`,
      `/posts?stampId=${stamp.id}&tripId=${trip.id}`,
      '/posts?tripId=invalid',
      `/posts?stampId=${stamp.id}&favoritesOnly=1`,
      `/posts?stampId=${stamp.id}&favoritesOnly=null`,
      '/genres',
      '/genres?tripId=invalid',
      '/stamps',
      '/stamps?genreId=invalid',
      '/trips/invalid',
      '/genres/invalid',
      '/stamps/invalid',
      '/posts/invalid',
      '/trips?limit=0',
      '/trips?limit=101',
      '/trips?limit=1.5',
      '/trips?cursor=invalid',
      `/posts?stampId=${stamp.id}&cursor=invalid`,
    ])
      await http('get', path, owner, undefined, 400);
    await http(
      'post',
      '/genres',
      owner,
      { tripId: 'invalid', name: 'Genre' },
      400,
    );
    await http(
      'post',
      '/stamps',
      owner,
      { genreId: 'invalid', name: 'Stamp' },
      400,
    );
    await http(
      'post',
      '/posts',
      owner,
      { stampId: 'invalid', ...mediaInput },
      400,
    );
    for (const path of [
      `/trips/${randomUUID()}`,
      `/genres/${randomUUID()}`,
      `/stamps/${randomUUID()}`,
      `/posts/${randomUUID()}`,
    ]) {
      await http('get', path, owner, undefined, 404);
    }
  });

  it('uses stable cursor pages for both chronological directions when timestamps tie', async () => {
    const { trip, genre, stamp } = await tree();
    const secondGenre = await http('post', '/genres', owner, {
      tripId: trip.id,
      name: 'Second',
    });
    const secondStamp = await http('post', '/stamps', owner, {
      genreId: genre.id,
      name: 'Second',
    });
    const postIds: string[] = [];
    for (let index = 0; index < 3; index++) {
      postIds.push(
        (
          await publish(owner, {
            stampId: stamp.id,
            ...mediaInput,
          })
        ).id,
      );
    }
    const tied = new Date('2026-09-07T00:00:00Z');
    await prisma.genre.updateMany({
      where: { tripId: trip.id },
      data: { createdAt: tied },
    });
    await prisma.stamp.updateMany({
      where: { genreId: genre.id },
      data: { createdAt: tied },
    });
    await prisma.post.updateMany({
      where: { stampId: stamp.id },
      data: { createdAt: tied },
    });

    const scopes: { path: string; query: Query; expected: string[] }[] = [
      {
        path: '/genres',
        query: { tripId: trip.id },
        expected: [genre.id, secondGenre.id].sort(),
      },
      {
        path: '/stamps',
        query: { genreId: genre.id },
        expected: [stamp.id, secondStamp.id].sort(),
      },
      {
        path: '/posts',
        query: { stampId: stamp.id },
        expected: postIds.sort().reverse(),
      },
    ];
    for (const { path, query, expected } of scopes) {
      const ids: string[] = [];
      let cursor: string | null = null;
      do {
        const page: Page = await get<Page>(path, owner, {
          ...query,
          limit: 1,
          ...(cursor ? { cursor } : {}),
        });
        expect(page.items).toHaveLength(1);
        ids.push(page.items[0].id);
        cursor = page.nextCursor;
        expect(ids.length).toBeLessThanOrEqual(expected.length);
      } while (cursor);
      expect(ids).toEqual(expected);
    }
  });
  it('normalizes locations, preserves omission, clears explicitly and rejects invalid arrays', async () => {
    const trip = await http('post', '/trips', owner, {
      ...tripInput,
      locations: [' 京都 ', '', '  ', '京都', '大阪'],
    });
    expect(trip.locations).toEqual(['京都', '京都', '大阪']);
    await http('patch', `/trips/${trip.id}`, owner, { name: '新しい名前' });
    expect((await get(`/trips/${trip.id}`, owner)).locations).toEqual(
      trip.locations,
    );
    await http('patch', `/trips/${trip.id}`, owner, { locations: [] });
    expect((await get(`/trips/${trip.id}`, owner)).locations).toEqual([]);
    for (const locations of [null, '京都', [1]]) {
      await http('patch', `/trips/${trip.id}`, owner, { locations }, 400);
      await http('post', '/trips', owner, { ...tripInput, locations }, 400);
    }
  });

  it('keeps photo reads per user, idempotent and separate from notifications; cascades deletion and progress', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);
    const photo = await publish(owner, {
      ...mediaInput,
      stampId: stamp.id,
    });
    expect(photo.readAt).toBeNull();
    expect(await get(`/stamps/${stamp.id}`, owner)).toMatchObject({
      hasUnreadPhotos: false,
      photoCount: 1,
    });
    expect(await get(`/stamps/${stamp.id}`, member)).toMatchObject({
      hasUnreadPhotos: true,
      photoCount: 1,
    });
    expect(await get(`/genres/${genre.id}`, member)).toMatchObject({
      hasUnreadPhotos: true,
    });
    const notifications = await get<Page & { unreadCount: number }>(
      '/notifications',
      member,
    );
    expect(notifications.unreadCount).toBe(1);
    expect(notifications.items[0]).toMatchObject({
      target: { type: 'photo', postId: photo.id },
    });
    await http(
      'patch',
      `/notifications/${notifications.items[0].id}/read`,
      outsider,
      undefined,
      404,
    );
    await http('patch', `/posts/${photo.id}/read`, outsider, undefined, 404);
    await http('delete', `/posts/${photo.id}`, outsider, undefined, 404);
    const reads = await Promise.all([
      http('patch', `/posts/${photo.id}/read`, member),
      http('patch', `/posts/${photo.id}/read`, member),
    ]);
    expect(reads[0].readAt).toEqual(expect.any(String));
    expect(reads[1].readAt).toEqual(reads[0].readAt);
    expect((await get(`/posts/${photo.id}`, owner)).readAt).toBeNull();
    expect((await get(`/posts/${photo.id}`, member)).readAt).toBe(
      reads[0].readAt,
    );
    expect(await get(`/stamps/${stamp.id}`, member)).toMatchObject({
      hasUnreadPhotos: false,
    });
    expect(await get(`/genres/${genre.id}`, member)).toMatchObject({
      hasUnreadPhotos: false,
    });
    expect(
      (await get<Page & { unreadCount: number }>('/notifications', member))
        .unreadCount,
    ).toBe(1);
    await http('delete', `/posts/${photo.id}`, member, undefined, 204);
    expect(await prisma.photoRead.count()).toBe(0);
    expect(await prisma.notification.count()).toBe(0);
    expect(await get(`/stamps/${stamp.id}`, owner)).toMatchObject({
      isCompleted: false,
      photoCount: 0,
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      isCompleted: false,
      completedStampCount: 0,
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      isCompleted: false,
      completedGenreCount: 0,
    });
  });

  it('notifies only other participants on effective changes, reports global unread count and filters images', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);
    expect(await prisma.notification.count()).toBe(0);
    await http('patch', `/trips/${trip.id}`, owner, {
      locations: [' 京都 ', ' '],
    });
    await http('patch', `/trips/${trip.id}`, owner, { locations: ['京都'] });
    await http('patch', `/genres/${genre.id}`, owner, { name: '更新' });
    await http('patch', `/genres/${genre.id}`, owner, { name: ' 更新 ' });
    await http('patch', `/stamps/${stamp.id}`, owner, { description: '更新' });
    await http('patch', `/stamps/${stamp.id}`, owner, { description: '更新' });
    await http('post', '/genres', owner, { tripId: trip.id, name: '追加' });
    await http('post', '/stamps', owner, { genreId: genre.id, name: '追加' });
    const image = await publish(owner, {
      ...mediaInput,
      stampId: stamp.id,
    });
    const video = await publish(owner, {
      ...mediaInput,
      stampId: stamp.id,
      mediaType: 'VIDEO',
    });
    await http('patch', `/posts/${image.id}/favorite`, member, {
      isFavorite: true,
    });
    expect(await prisma.notification.count()).toBe(7);
    const first = await get<Page & { unreadCount: number }>(
      '/notifications',
      member,
      { limit: 1 },
    );
    expect(first.items).toHaveLength(1);
    expect(first.unreadCount).toBe(7);
    const read = await http(
      'patch',
      `/notifications/${first.items[0].id}/read`,
      member,
    );
    expect(
      (await http('patch', `/notifications/${read.id}/read`, member)).readAt,
    ).toBe(read.readAt);
    expect((await get(`/posts/${image.id}`, member)).readAt).toBeNull();
    const rest = await get<Page & { unreadCount: number }>(
      '/notifications',
      member,
      { cursor: first.nextCursor!, limit: 100 },
    );
    expect(rest.items).toHaveLength(6);
    expect(rest.unreadCount).toBe(6);
    expect((await get<Page>('/notifications', owner)).items).toEqual([]);
    expect((await get<Page>('/notifications', outsider)).items).toEqual([]);
    expect(
      (
        await get<Page>('/posts', member, {
          genreId: genre.id,
          mediaType: 'IMAGE',
        })
      ).items.map((item) => item.id),
    ).toEqual([image.id]);
    expect(
      (
        await get<Page>('/posts', member, {
          tripId: trip.id,
          mediaType: 'VIDEO',
        })
      ).items.map((item) => item.id),
    ).toEqual([video.id]);
    await http(
      'get',
      `/posts?stampId=${stamp.id}&mediaType=AUDIO`,
      owner,
      undefined,
      400,
    );
    expect(
      (await http('patch', `/posts/${video.id}/read`, member)).readAt,
    ).toEqual(expect.any(String));
    const onboarding = await actor('New', 'ONBOARDING');
    for (const [method, path] of [
      ['get', '/notifications'],
      ['patch', `/notifications/${read.id}/read`],
      ['patch', `/posts/${image.id}/read`],
      ['delete', `/posts/${image.id}`],
    ] as [Method, string][]) {
      await http(method, path, null, undefined, 401);
      await http(method, path, onboarding, undefined, 403);
    }
  });

  it('limits batches, scopes pending uploads to their author, and keeps pending media out of every aggregate', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);
    const files = Array.from({ length: 30 }, (_, index) => ({
      clientId: `file-${index}`,
      fileName: `photo-${index}.jpg`,
      mediaType: 'IMAGE',
      mimeType: 'image/jpeg',
      byteSize: 50_000_000,
    }));
    await http(
      'post',
      '/uploads/batches',
      owner,
      {
        stampId: stamp.id,
        files: [...files, { ...files[0], clientId: 'extra' }],
      },
      400,
    );
    await http(
      'post',
      '/uploads/batches',
      owner,
      {
        stampId: stamp.id,
        files: Array.from({ length: 6 }, (_, index) => ({
          clientId: `video-${index}`,
          fileName: 'video.mp4',
          mediaType: 'VIDEO',
          mimeType: 'video/mp4',
          byteSize: 1_000_000_000,
          durationMs: 300_000,
        })),
      },
      400,
    );
    for (const invalid of [
      { ...files[0], byteSize: 50_000_001 },
      { ...files[0], byteSize: 0 },
      { ...files[0], mimeType: 'image/svg+xml' },
      {
        ...files[0],
        mediaType: 'VIDEO',
        mimeType: 'video/mp4',
        byteSize: 1_000_000_001,
      },
      {
        ...files[0],
        mediaType: 'VIDEO',
        mimeType: 'video/mp4',
        durationMs: 300_001,
      },
    ])
      await http(
        'post',
        '/uploads/batches',
        owner,
        { stampId: stamp.id, files: [invalid] },
        400,
      );
    expect(await prisma.post.count()).toBe(0);

    const clientRequestId = randomUUID();
    const input = { stampId: stamp.id, clientRequestId, files };
    const batch = await http<{
      id: string;
      uploads: Array<{ id: string; status: string }>;
    }>('post', '/uploads/batches', owner, input);
    expect(batch.uploads).toHaveLength(30);
    expect(batch.uploads.every((item) => item.status === 'PENDING')).toBe(true);
    expect(
      (await http<{ id: string }>('post', '/uploads/batches', owner, input)).id,
    ).toBe(batch.id);
    expect(await prisma.post.count()).toBe(30);
    for (const who of [member, outsider]) {
      await http('get', `/uploads/batches/${batch.id}`, who, undefined, 404);
      await http(
        'post',
        `/uploads/${batch.uploads[0]!.id}/complete`,
        who,
        {},
        404,
      );
      await http(
        'delete',
        `/uploads/${batch.uploads[0]!.id}`,
        who,
        undefined,
        404,
      );
    }
    await http('get', `/posts/${batch.uploads[0]!.id}`, member, undefined, 404);
    for (const who of [owner, member])
      await http(
        'delete',
        `/posts/${batch.uploads[0]!.id}`,
        who,
        undefined,
        404,
      );
    await http(
      'get',
      `/posts/${batch.uploads[0]!.id}/original`,
      owner,
      undefined,
      404,
    );
    expect(
      (await get<Page>('/posts', owner, { stampId: stamp.id })).items,
    ).toEqual([]);
    expect(await get(`/stamps/${stamp.id}`, member)).toMatchObject({
      isCompleted: false,
      photoCount: 0,
      hasUnreadPhotos: false,
    });
    expect(await get(`/genres/${genre.id}`, member)).toMatchObject({
      completedStampCount: 0,
      hasUnreadPhotos: false,
    });
    expect(await get(`/trips/${trip.id}`, member)).toMatchObject({
      completedGenreCount: 0,
    });
    expect(await prisma.notification.count()).toBe(0);
    await http(
      'post',
      '/posts',
      owner,
      { stampId: stamp.id, ...mediaInput },
      400,
    );
    await http(
      'delete',
      `/uploads/${batch.uploads[0]!.id}`,
      owner,
      undefined,
      204,
    );
    expect(
      (
        await prisma.post.findUniqueOrThrow({
          where: { id: batch.uploads[0]!.id },
        })
      ).status,
    ).toBe('CANCELLED');
  });

  it('publishes independently, returns only derivative display URLs, and exposes originals only to participants', async () => {
    const { trip, stamp } = await tree();
    await join(trip.id);
    const post = await publish(owner, { stampId: stamp.id, ...mediaInput });
    const row = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    const detail = await get<Record<string, unknown>>(
      `/posts/${post.id}`,
      member,
    );
    expect(detail.smallUrl).toContain(encodeURIComponent(row.smallKey!));
    expect(detail.largeUrl).toContain(encodeURIComponent(row.largeKey!));
    expect(detail.mediaUrl).toBe(detail.largeUrl);
    expect(detail).not.toHaveProperty('originalKey');
    expect(detail).not.toHaveProperty('originalUrl');
    expect(JSON.stringify(detail)).not.toContain(
      encodeURIComponent(row.originalKey!),
    );
    const download = await get<{
      url: string;
      fileName: string;
      mimeType: string;
    }>(`/posts/${post.id}/original`, member);
    expect(download.url).toContain(encodeURIComponent(row.originalKey!));
    expect(download).toMatchObject({
      fileName: 'photo.jpg',
      mimeType: 'image/jpeg',
    });
    await http('get', `/posts/${post.id}/original`, outsider, undefined, 404);

    await lifecycle.process(row.id, row.processingVersion);
    await http('post', `/uploads/${post.id}/complete`, owner, {});
    expect(
      await prisma.notification.count({ where: { postId: post.id } }),
    ).toBe(1);
    await http('delete', `/posts/${post.id}`, member, undefined, 204);
    await lifecycle.process(row.id, row.processingVersion);
    expect(await prisma.post.findUnique({ where: { id: post.id } })).toBeNull();
    expect(await prisma.mediaCleanup.count()).toBeGreaterThan(0);
    expect(await prisma.notification.count()).toBe(0);
  });

  it('keeps legacy media hidden and preserves identity, timestamps, favorites and reads through backfill', async () => {
    const { trip, stamp } = await tree();
    await join(trip.id);
    const legacy = await prisma.post.create({
      data: {
        stampId: stamp.id,
        authorId: owner.id,
        mediaType: 'IMAGE',
        mediaUrl: 'https://old.example.test/original.jpg',
        status: 'LEGACY',
        isLegacy: true,
        isFavorite: true,
        createdAt: new Date('2020-01-01T00:00:00Z'),
        updatedAt: new Date('2021-02-03T04:05:06Z'),
      },
    });
    const readAt = new Date('2022-03-04T05:06:07Z');
    await prisma.photoRead.create({
      data: { postId: legacy.id, userId: member.id, readAt },
    });
    expect(
      (await get<Page>('/posts', owner, { stampId: stamp.id })).items,
    ).toEqual([]);
    await http('get', `/posts/${legacy.id}`, owner, undefined, 404);
    expect(
      await prisma.post.findUnique({ where: { id: legacy.id } }),
    ).toMatchObject({
      mediaUrl: legacy.mediaUrl,
      isFavorite: true,
      createdAt: legacy.createdAt,
    });
    await lifecycle.migrateLegacy(legacy.id);
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: legacy.id } }),
    ).toMatchObject({
      id: legacy.id,
      authorId: owner.id,
      isFavorite: true,
      status: 'READY',
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      mediaUrl: null,
      originalKey: expect.any(String),
      largeKey: expect.any(String),
      smallKey: expect.any(String),
    });
    expect((await get(`/posts/${legacy.id}`, member)).readAt).toBe(
      readAt.toISOString(),
    );
    expect(await prisma.notification.count()).toBe(0);
  });

  it('rolls back target changes when notification insertion fails', async () => {
    const { trip, genre, stamp } = await tree();
    await join(trip.id);
    // Force a real database failure after the target write, inside its transaction.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION reject_test_notification() RETURNS trigger AS $$
      BEGIN RAISE EXCEPTION 'test notification failure'; END;
    $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_test_notification BEFORE INSERT ON notifications
      FOR EACH ROW EXECUTE FUNCTION reject_test_notification()`);
    try {
      await http(
        'patch',
        `/trips/${trip.id}`,
        owner,
        { name: 'Must rollback' },
        500,
      );
      await http(
        'patch',
        `/genres/${genre.id}`,
        owner,
        { name: 'Must rollback' },
        500,
      );
      await http(
        'patch',
        `/stamps/${stamp.id}`,
        owner,
        { name: 'Must rollback' },
        500,
      );
      await expect(
        publish(owner, { stampId: stamp.id, ...mediaInput }),
      ).rejects.toThrow();
      expect((await get(`/trips/${trip.id}`, owner)).name).toBe(trip.name);
      expect((await get(`/genres/${genre.id}`, owner)).name).toBe(genre.name);
      expect((await get(`/stamps/${stamp.id}`, owner)).name).toBe(stamp.name);
      expect(await prisma.post.count({ where: { status: 'READY' } })).toBe(0);
      expect(await prisma.notification.count()).toBe(0);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER reject_test_notification ON notifications',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION reject_test_notification()',
      );
    }
  });
  it('validates cover upload ownership, metadata and readiness, with idempotent preparation', async () => {
    const input = {
      clientRequestId: randomUUID(),
      byteSize: 100,
      mimeType: 'image/png',
    };
    await http('post', '/uploads/covers', null, input, 401);
    await http(
      'post',
      '/uploads/covers',
      owner,
      { ...input, byteSize: 50_000_001 },
      400,
    );
    await http(
      'post',
      '/uploads/covers',
      owner,
      { ...input, mimeType: 'video/mp4' },
      400,
    );
    const [first, duplicate] = await Promise.all([
      http('post', '/uploads/covers', owner, input),
      http('post', '/uploads/covers', owner, input),
    ]);
    expect(first.id).toBe(duplicate.id);
    await http(
      'post',
      '/uploads/covers',
      owner,
      { ...input, byteSize: 101 },
      409,
    );
    await http('get', `/uploads/covers/${first.id}`, outsider, undefined, 404);
    await http(
      'post',
      '/trips',
      owner,
      { ...tripInput, coverAssetId: first.id },
      409,
    );
    const row = await prisma.coverAsset.findUniqueOrThrow({
      where: { id: first.id },
    });
    storage.objects.set(row.stagingKey!, {
      byteSize: 99,
      contentType: 'image/png',
    });
    await http('post', `/uploads/covers/${first.id}/complete`, owner, {}, 400);
    storage.objects.set(row.stagingKey!, {
      byteSize: 100,
      contentType: 'image/png',
    });
    await Promise.all([
      http('post', `/uploads/covers/${first.id}/complete`, owner, {}),
      http('post', `/uploads/covers/${first.id}/complete`, owner, {}),
    ]);
    await app.get(CoverAssetsService).process(first.id);
    await http(
      'post',
      '/trips',
      outsider,
      { ...tripInput, coverAssetId: first.id },
      404,
    );
    const trip = await http('post', '/trips', owner, {
      ...tripInput,
      coverAssetId: first.id,
    });
    expect(trip.coverImageUrl).toContain('https://media.example.test/');
    await http('delete', `/uploads/covers/${first.id}`, owner, undefined, 409);
    await http(
      'post',
      '/trips',
      owner,
      { ...tripInput, coverAssetId: first.id },
      409,
    );
  });

  it('creates a trip once after response loss and presents its private cover to members and invitees', async () => {
    const id = await cover();
    const input = {
      ...tripInput,
      coverAssetId: id,
      clientRequestId: randomUUID(),
      inviteeNames: ['Member'],
    };
    const [trip, retry] = await Promise.all([
      http('post', '/trips', owner, input),
      http('post', '/trips', owner, input),
    ]);
    expect(retry.id).toBe(trip.id);
    expect(await prisma.trip.count()).toBe(1);
    const stored = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    expect(stored.coverImageUrl).toBeNull();
    expect(stored.coverAssetId).toBe(id);
    expect((await get<Page>('/trips', owner)).items[0].coverImageUrl).toBe(
      trip.coverImageUrl,
    );
    const invitations = await get<Page<{ trip: Resource }>>(
      '/invitations',
      member,
    );
    expect(invitations.items[0].trip.coverImageUrl).toBe(trip.coverImageUrl);
    const updated = await http('patch', `/trips/${trip.id}`, owner, {
      name: 'Changed',
    });
    expect(updated.coverImageUrl).toBe(trip.coverImageUrl);
    expect(await prisma.coverAsset.count()).toBe(1);
    await http('get', `/trips/${trip.id}`, outsider, undefined, 404);
    await http(
      'patch',
      `/trips/${trip.id}`,
      owner,
      { coverImageUrl: trip.coverImageUrl },
      400,
    );
  });

  it('replaces and removes covers atomically, preserving legacy URLs until an explicit change', async () => {
    const trip = await http('post', '/trips', owner, tripInput);
    await prisma.trip.update({
      where: { id: trip.id },
      data: { coverImageUrl: 'https://legacy.example.test/cover.jpg' },
    });
    await http('patch', `/trips/${trip.id}`, owner, { name: 'Legacy' });
    expect((await get(`/trips/${trip.id}`, owner)).coverImageUrl).toBe(
      'https://legacy.example.test/cover.jpg',
    );
    await join(trip.id);
    const first = await cover(member);
    await http('patch', `/trips/${trip.id}`, member, { coverAssetId: first });
    const old = await prisma.coverAsset.findUniqueOrThrow({
      where: { id: first },
    });
    const next = await cover();
    await http(
      'patch',
      `/trips/${trip.id}`,
      outsider,
      { coverAssetId: next },
      404,
    );
    expect(
      await prisma.coverAsset.findUnique({ where: { id: first } }),
    ).not.toBeNull();
    await http('patch', `/trips/${trip.id}`, owner, { coverAssetId: next });
    expect(
      await prisma.coverAsset.findUnique({ where: { id: first } }),
    ).toBeNull();
    expect(
      await prisma.mediaCleanup.findFirst({
        where: { keys: { has: old.imageKey! } },
      }),
    ).not.toBeNull();
    await http('patch', `/trips/${trip.id}`, member, { coverAssetId: null });
    expect((await get(`/trips/${trip.id}`, owner)).coverImageUrl).toBeNull();
    expect(
      await prisma.coverAsset.findUnique({ where: { id: next } }),
    ).toBeNull();
  });

  it('cleans abandoned covers, retains attached covers, and cannot republish cancelled processing', async () => {
    const attached = await cover();
    const trip = await http('post', '/trips', owner, {
      ...tripInput,
      coverAssetId: attached,
    });
    const abandoned = await cover();
    await prisma.coverAsset.updateMany({
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    const covers = app.get(CoverAssetsService);
    await covers.cleanup();
    expect(
      await prisma.coverAsset.findUnique({ where: { id: attached } }),
    ).not.toBeNull();
    expect(
      await prisma.coverAsset.findUnique({ where: { id: abandoned } }),
    ).toBeNull();
    const processing = await http('post', '/uploads/covers', owner, {
      clientRequestId: randomUUID(),
      byteSize: 100,
      mimeType: 'image/png',
    });
    await prisma.coverAsset.update({
      where: { id: processing.id },
      data: { status: 'PROCESSING' },
    });
    const processor = app.get(MediaProcessor);
    const spy = vi
      .spyOn(processor, 'processCover')
      .mockImplementationOnce(async () => {
        await covers.cancel(owner.id, processing.id);
        return {
          imageKey: 'covers/cancelled.webp',
          blurhash: 'test',
          width: 800,
          height: 500,
        };
      });
    try {
      await covers.process(processing.id);
    } finally {
      spy.mockRestore();
    }
    expect(
      await prisma.coverAsset.findUnique({ where: { id: processing.id } }),
    ).toBeNull();
    expect(
      await prisma.mediaCleanup.findFirst({
        where: { keys: { has: 'covers/cancelled.webp' } },
      }),
    ).not.toBeNull();
    const asset = await prisma.coverAsset.findUniqueOrThrow({
      where: { id: attached },
    });
    await prisma.trip.delete({ where: { id: trip.id } });
    expect(
      await prisma.coverAsset.findUnique({ where: { id: attached } }),
    ).toBeNull();
    expect(
      await prisma.mediaCleanup.findFirst({
        where: { keys: { has: asset.imageKey! } },
      }),
    ).not.toBeNull();
  });
  it('rolls back a cover replacement if the trip update cannot commit', async () => {
    const first = await cover();
    const trip = await http('post', '/trips', owner, {
      ...tripInput,
      coverAssetId: first,
    });
    await join(trip.id);
    const next = await cover(member);
    const old = await prisma.coverAsset.findUniqueOrThrow({
      where: { id: first },
    });
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION reject_cover_notification() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'test cover rollback'; END; $$ LANGUAGE plpgsql`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER reject_cover_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_cover_notification()`,
    );
    try {
      await http(
        'patch',
        `/trips/${trip.id}`,
        member,
        { coverAssetId: next },
        500,
      );
      expect(
        (await prisma.trip.findUniqueOrThrow({ where: { id: trip.id } }))
          .coverAssetId,
      ).toBe(first);
      expect(
        await prisma.coverAsset.findUnique({ where: { id: first } }),
      ).not.toBeNull();
      expect(
        await prisma.coverAsset.findUnique({ where: { id: next } }),
      ).not.toBeNull();
      expect(
        await prisma.mediaCleanup.findFirst({
          where: { keys: { has: old.imageKey! } },
        }),
      ).toBeNull();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER reject_cover_notification ON notifications',
      );
      await prisma.$executeRawUnsafe(
        'DROP FUNCTION reject_cover_notification()',
      );
    }
  });

  it('serializes attaching a cover against cancellation without publishing a deleted image', async () => {
    const trip = await http('post', '/trips', owner, tripInput);
    const id = await cover();
    const results = await Promise.all([
      request(app.getHttpServer())
        .patch(`/trips/${trip.id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ coverAssetId: id }),
      request(app.getHttpServer())
        .delete(`/uploads/covers/${id}`)
        .set('Authorization', `Bearer ${owner.accessToken}`),
    ]);
    const current = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
    });
    if (current.coverAssetId) {
      expect(results.map((result) => result.status)).toEqual([200, 409]);
      expect(
        await prisma.coverAsset.findUnique({ where: { id } }),
      ).not.toBeNull();
    } else {
      expect(results.map((result) => result.status)).toEqual([404, 204]);
      expect(await prisma.coverAsset.findUnique({ where: { id } })).toBeNull();
    }
  });
});
