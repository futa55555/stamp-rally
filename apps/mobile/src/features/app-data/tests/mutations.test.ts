import { describe, expect, it } from 'vitest';
import { MAX_POST_PHOTOS } from '../../photos/model/inputs';
import { isUnreadPhoto, selectPhotos } from '../../photos/model/selectors';
import { sortTrips } from '../../trips/model/selectors';
import {
  validateNamedInput,
  validateTripInput,
} from '../../trips/model/validation';
import { resolveTarget } from '../../trips/navigation/targets';
import { DEMO_USER_ID, createDemoData } from '../mocks/fixtures';
import { createMockService } from '../mocks/service';
import type { DomainChange } from '../model/changes';
import type { StoreState } from '../model/reducer';
import { initialState, reducer } from '../model/reducer';

const tripInput = {
  name: ' 新しい旅 ',
  startDate: '2026-09-08',
  endDate: '2026-09-10',
  coverAssetId: null,
  locations: [],
};

const named = { name: '発見', description: '旅の記録' };

describe('domain creation and shared progress', () => {
  it('creates a complete trip hierarchy and atomically applies a multi-photo post to both stores', async () => {
    const initial = createDemoData();
    const service = createMockService(initial, 0);
    let state: StoreState = {
      ...initialState,
      data: initial,
      userId: DEMO_USER_ID,
    };
    const apply = (change: DomainChange) => {
      state = reducer(state, change);
    };
    const trip = await service.createTrip(DEMO_USER_ID, tripInput);
    apply({ type: 'tripSaved', trip, memberId: DEMO_USER_ID });
    expect(trip.name).toBe('新しい旅');
    expect(state.data!.memberships.filter((m) => m.tripId === trip.id)).toEqual(
      [{ tripId: trip.id, userId: DEMO_USER_ID }],
    );
    expect(trip.isCompleted).toBe(false);
    const genre = await service.createGenre(DEMO_USER_ID, {
      ...named,
      tripId: trip.id,
    });
    apply({ type: 'genreSaved', genre });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      totalGenreCount: 1,
      completedGenreCount: 0,
      isCompleted: false,
    });
    const stamp = await service.createStamp(DEMO_USER_ID, {
      ...named,
      genreId: genre.id,
    });
    apply({ type: 'stampSaved', stamp });
    const before = state.data!;
    const posts = await service.createPosts(DEMO_USER_ID, {
      stampId: stamp.id,
      mediaUrls: ['file:///first.jpg', 'content://photos/second'],
    });
    apply({ type: 'postsCreated', posts });
    expect(posts).toHaveLength(2);
    expect(new Set(posts.map((p) => p.id)).size).toBe(2);
    for (const post of posts) {
      expect(post).toMatchObject({
        stampId: stamp.id,
        genreId: genre.id,
        tripId: trip.id,
        mediaType: 'IMAGE',
        isFavorite: false,
        author: { id: DEMO_USER_ID },
      });
      expect(isUnreadPhoto(state.data!, DEMO_USER_ID, post)).toBe(false);
      expect(isUnreadPhoto(state.data!, initial.users[1].id, post)).toBe(true);
    }
    expect(state.data!.genres.find((g) => g.id === genre.id)).toMatchObject({
      totalStampCount: 1,
      completedStampCount: 1,
      isCompleted: true,
    });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      completedGenreCount: 1,
      isCompleted: true,
    });
    expect(before.stamps.find((s) => s.id === stamp.id)?.isCompleted).toBe(
      false,
    );
    expect(state.data).toEqual(await service.load());
    expect(
      resolveTarget(
        state.data!,
        { type: 'stamp', stampId: stamp.id },
        DEMO_USER_ID,
      )?.map((r) => r.name),
    ).toEqual(['index', 'trip/[tripId]', 'genre/[genreId]', 'stamp/[stampId]']);
    apply({ type: 'postsCreated', posts });
    expect(selectPhotos(state.data!, { stampId: stamp.id })).toHaveLength(2);
    const favorite = await service.setFavorite(posts[0].id, true);
    state = reducer(state, { type: 'favoriteUpdated', post: favorite });
    expect(
      selectPhotos(state.data!, { tripId: trip.id }, true).map((p) => p.id),
    ).toEqual([posts[0].id]);
    const another = await service.createStamp(DEMO_USER_ID, {
      ...named,
      genreId: genre.id,
    });
    apply({ type: 'stampSaved', stamp: another });
    expect(state.data!.genres.find((g) => g.id === genre.id)).toMatchObject({
      completedStampCount: 1,
      totalStampCount: 2,
      isCompleted: false,
    });
    expect(state.data!.trips.find((t) => t.id === trip.id)?.isCompleted).toBe(
      false,
    );
    expect(state.data).toEqual(await service.load());
    expect(initial.trips.some((t) => t.id === trip.id)).toBe(false);
    const secondBatch = await service.createPosts(DEMO_USER_ID, {
      stampId: another.id,
      mediaUrls: ['file:///third.jpg'],
    });
    apply({ type: 'postsCreated', posts: secondBatch });
    expect(state.data!.trips.find((t) => t.id === trip.id)?.isCompleted).toBe(
      true,
    );
    const emptyGenre = await service.createGenre(DEMO_USER_ID, {
      ...named,
      tripId: trip.id,
    });
    apply({ type: 'genreSaved', genre: emptyGenre });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      totalGenreCount: 2,
      completedGenreCount: 1,
      isCompleted: false,
    });
    expect(state.data).toEqual(await service.load());
  });

  it('updates editable fields, preserves relationships and retains writes across sign out', async () => {
    const service = createMockService(createDemoData(), 0);
    const snapshot = await service.load();
    const trip = snapshot.trips[0],
      genre = snapshot.genres[0],
      stamp = snapshot.stamps[0];
    const updated = await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...tripInput,
      name: '更新した旅',
      startDate: '2030-01-01',
      endDate: '2030-01-02',
      coverAssetId: '12345678-1234-4234-8234-123456789abc',
    });
    const newGenre = await service.updateGenre(DEMO_USER_ID, genre.id, {
      name: '新ジャンル',
      description: '',
    });
    const newStamp = await service.updateStamp(DEMO_USER_ID, stamp.id, {
      name: '新スタンプ',
      description: '説明を更新',
    });
    expect(updated.createdAt).toBe(trip.createdAt);
    expect(newGenre.tripId).toBe(genre.tripId);
    expect(newStamp.genreId).toBe(stamp.genreId);
    expect(newStamp.isCompleted).toBe(stamp.isCompleted);
    expect(snapshot.trips[0].name).toBe(trip.name);
    expect((await service.load()).trips[0].name).toBe('更新した旅');
    await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...updated,
      coverAssetId: null,
    });
    await service.signOut();
    await service.signIn('google');
    const after = await service.load();
    expect(after.trips[0].coverImageUrl).toBeNull();
    expect(after.genres[0].description).toBe('');
    expect(sortTrips(after.trips, '2030-01-01')[0].id).toBe(trip.id);
    expect((await createMockService(snapshot, 0).load()).trips[0].name).toBe(
      trip.name,
    );
  });

  it('rejects inaccessible parents and entities without changing any data', async () => {
    const initial = createDemoData();
    initial.memberships = initial.memberships.filter(
      (m) => m.userId !== DEMO_USER_ID,
    );
    const service = createMockService(initial, 0);
    await expect(
      service.createGenre(DEMO_USER_ID, {
        ...named,
        tripId: initial.trips[0].id,
      }),
    ).rejects.toThrow();
    await expect(
      service.createStamp(DEMO_USER_ID, {
        ...named,
        genreId: initial.genres[0].id,
      }),
    ).rejects.toThrow();
    await expect(
      service.createPosts(DEMO_USER_ID, {
        stampId: initial.stamps[0].id,
        mediaUrls: ['file:///a.jpg'],
      }),
    ).rejects.toThrow();
    await expect(
      service.updateTrip(DEMO_USER_ID, initial.trips[0].id, tripInput),
    ).rejects.toThrow();
    await expect(
      service.updateGenre(DEMO_USER_ID, initial.genres[0].id, named),
    ).rejects.toThrow();
    await expect(
      service.updateStamp(DEMO_USER_ID, initial.stamps[0].id, named),
    ).rejects.toThrow();
    await expect(
      service.createTrip('missing-user', tripInput),
    ).rejects.toThrow();
    expect(await service.load()).toEqual(initial);
  });

  it('rejects the whole batch on invalid media, missing stamps, or invalid counts', async () => {
    const service = createMockService(createDemoData(), 0);
    const snapshot = await service.load();
    const stampId = snapshot.stamps[0].id;
    for (const mediaUrls of [
      [],
      ['file:///valid.jpg', 'invalid'],
      Array(MAX_POST_PHOTOS + 1).fill('file:///a.jpg'),
    ])
      await expect(
        service.createPosts(DEMO_USER_ID, { stampId, mediaUrls }),
      ).rejects.toThrow();
    await expect(
      service.createPosts(DEMO_USER_ID, {
        stampId: 'missing',
        mediaUrls: ['file:///a.jpg'],
      }),
    ).rejects.toThrow();
    await expect(
      service.updateStamp(DEMO_USER_ID, stampId, { ...named, name: ' ' }),
    ).rejects.toThrow();
    expect(await service.load()).toEqual(snapshot);
  });
});

describe('editor validation', () => {
  it('validates names by Unicode code points and preserves optional descriptions', () => {
    expect(
      validateNamedInput({ name: '  🌿'.trim().repeat(100), description: '' })
        .name,
    ).toHaveLength(200);
    expect(() =>
      validateNamedInput({ name: '🌿'.repeat(101), description: '' }),
    ).toThrow('1〜100');
    expect(() =>
      validateNamedInput({ name: '\n ', description: '' }),
    ).toThrow();
    expect(
      validateNamedInput({ ...named, description: '🌿'.repeat(2000) })
        .description,
    ).toHaveLength(4000);
    expect(() =>
      validateNamedInput({ ...named, description: 'a'.repeat(2001) }),
    ).toThrow('2,000');
  });
  it('accepts calendar boundaries and rejects impossible and reversed dates', () => {
    expect(
      validateTripInput({
        ...tripInput,
        startDate: '2028-02-29',
        endDate: '2028-02-29',
      }).startDate,
    ).toBe('2028-02-29');
    for (const startDate of [
      '2026-02-29',
      '2026-13-01',
      '2026-2-01',
      '0000-01-01',
      'invalid',
    ])
      expect(() => validateTripInput({ ...tripInput, startDate })).toThrow();
    expect(() =>
      validateTripInput({ ...tripInput, endDate: '2026-09-07' }),
    ).toThrow('終了日');
    expect(() =>
      validateTripInput({
        ...tripInput,
        coverAssetId: 'invalid',
      }),
    ).toThrow();
  });
});
