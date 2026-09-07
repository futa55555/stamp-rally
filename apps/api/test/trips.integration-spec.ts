import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { AuthTokenService } from '../src/auth/auth-token/auth-token.service.js';
import { PrismaService } from '../src/database/prisma.service.js';

interface Actor {
  id: string;
  name: string;
  accessToken: string;
}

interface Resource {
  id: string;
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
  text: string;
}

interface Page<T = Resource> {
  items: T[];
  nextCursor: string | null;
}

type Method = 'get' | 'post' | 'patch';
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

  async function cleanDatabase() {
    await prisma.trip.deleteMany();
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
    }).compile();
    prisma = moduleRef.get(PrismaService);
    tokens = moduleRef.get(AuthTokenService);
    app = moduleRef.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    await cleanDatabase();
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
    expect(pending.items[0].trip).toEqual({
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
      `/comments?stampId=${stamp.id}`,
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
      coverImageUrl: 'https://example.com/cover.png',
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
    const comment = await http('post', '/comments', member, {
      stampId: stamp.id,
      text: '  おいしい  ',
    });
    const post = await http('post', '/posts', member, {
      stampId: stamp.id,
      ...mediaInput,
    });

    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: '共同の旅',
      coverImageUrl: 'https://example.com/cover.png',
    });
    expect(await get(`/genres/${genre.id}`, owner)).toMatchObject({
      name: 'ごはん',
      description: '説明',
    });
    expect(await get(`/stamps/${stamp.id}`, outsider)).toMatchObject({
      name: '朝食',
      description: '朝に集合',
    });
    expect(comment).toMatchObject({
      text: 'おいしい',
      author: { id: member.id, name: member.name },
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
      (await get<Page>('/comments', owner, { stampId: stamp.id })).items.map(
        (item) => item.id,
      ),
    ).toEqual([comment.id]);
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
      ['get', `/comments?stampId=${stamp.id}`],
      ['post', '/comments', { stampId: stamp.id, text: 'Comment' }],
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
    const post = await http('post', '/posts', owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const comment = await http('post', '/comments', owner, {
      stampId: stamp.id,
      text: 'Private comment',
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
      ['get', `/comments?stampId=${stamp.id}`],
      ['post', '/comments', { stampId: stamp.id, text: 'Intrusion' }],
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
      (await get<Page>('/comments', owner, { stampId: stamp.id })).items.map(
        (item) => item.id,
      ),
    ).toEqual([comment.id]);
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: '秋の旅',
      totalGenreCount: 1,
    });
  });

  it('rejects parent reassignment and caller-supplied author or identity fields', async () => {
    const { trip, genre, stamp } = await tree();
    const other = await tree();
    const post = await http('post', '/posts', owner, {
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
        'post',
        '/comments',
        { stampId: stamp.id, text: 'Text', authorId: outsider.id },
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
    await http('post', '/comments', owner, {
      stampId: stamp.id,
      text: 'Comments are not completion',
    });
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

    await http('post', '/posts', owner, { stampId: stamp.id, ...mediaInput });
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
    await http('post', '/posts', owner, {
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
    await http('post', '/posts', owner, {
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
    const first = await http('post', '/posts', owner, {
      stampId: stamp.id,
      ...mediaInput,
    });
    const second = await http('post', '/posts', member, {
      stampId: stamp.id,
      ...mediaInput,
      mediaUrl: 'https://example.com/second.jpg',
    });
    const foreign = await tree(outsider);
    const foreignPost = await http('post', '/posts', outsider, {
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
      coverImageUrl: null,
    });
    expect(trip).toMatchObject({
      startDate: '2028-02-29',
      endDate: '2028-02-29',
      coverImageUrl: null,
    });
    await http('patch', `/trips/${trip.id}`, owner, {
      endDate: '2028-03-01',
      coverImageUrl: 'https://example.com/cover.jpg',
    });
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      startDate: '2028-02-29',
      endDate: '2028-03-01',
    });
    await http('patch', `/trips/${trip.id}`, owner, {
      startDate: '2028-03-01',
      coverImageUrl: null,
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
        coverImageUrl: 'https://example.com/concurrent-cover.jpg',
      }),
    ]);
    expect(await get(`/trips/${trip.id}`, owner)).toMatchObject({
      name: 'Concurrent name',
      coverImageUrl: 'https://example.com/concurrent-cover.jpg',
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
    const post = await http('post', '/posts', owner, {
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
      ['post', '/comments', { stampId: stamp.id }],
      ['post', '/comments', { stampId: stamp.id, text: null }],
      ['post', '/comments', { stampId: stamp.id, text: ' \n ' }],
      ['post', '/comments', { stampId: stamp.id, text: 'x'.repeat(2001) }],
      ['patch', `/posts/${post.id}/favorite`, {}],
      ['patch', `/posts/${post.id}/favorite`, { isFavorite: null }],
      ['patch', `/posts/${post.id}/favorite`, { isFavorite: 'true' }],
    ];
    for (const [method, path, body] of invalidRequests)
      await http(method, path, owner, body, 400);
    expect(await prisma.post.count()).toBe(1);
    expect(await prisma.comment.count()).toBe(0);
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
      '/comments',
      '/comments?stampId=invalid',
      '/trips/invalid',
      '/genres/invalid',
      '/stamps/invalid',
      '/posts/invalid',
      '/trips?limit=0',
      '/trips?limit=101',
      '/trips?limit=1.5',
      '/trips?cursor=invalid',
      `/posts?stampId=${stamp.id}&cursor=invalid`,
      `/comments?stampId=${stamp.id}&cursor=invalid`,
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
    await http(
      'post',
      '/comments',
      owner,
      { stampId: 'invalid', text: 'Comment' },
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
    const commentIds: string[] = [];
    for (let index = 0; index < 3; index++) {
      postIds.push(
        (
          await http('post', '/posts', owner, {
            stampId: stamp.id,
            ...mediaInput,
          })
        ).id,
      );
      commentIds.push(
        (
          await http('post', '/comments', owner, {
            stampId: stamp.id,
            text: `Comment ${index}`,
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
    await prisma.comment.updateMany({
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
      {
        path: '/comments',
        query: { stampId: stamp.id },
        expected: commentIds.sort(),
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
});
