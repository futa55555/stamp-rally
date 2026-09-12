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
  it('creates selected templates once and preserves activities when editing the trip', async () => {
    const service = createMockService(createDemoData(), 0);
    const input = {
      ...tripInput,
      clientRequestId: 'same-request',
      activityPresets: ['海'],
      customActivities: [' 星空を見る '],
      selectedCategories: [
        {
          name: '自然',
          stamps: [{ title: '海を見る' }, { title: '海を見る' }],
        },
        { name: '自然', stamps: [{ title: '山を見る' }] },
        { name: '空のカテゴリー', stamps: [] },
      ],
    };
    const trip = await service.createTrip(DEMO_USER_ID, input);
    expect(trip.totalCategoryCount).toBe(1);
    expect(trip.activityPresets).toEqual(['海']);
    expect(trip.customActivities).toEqual(['星空を見る']);
    const repeated = await service.createTrip(DEMO_USER_ID, input);
    expect(repeated.id).toBe(trip.id);
    const data = await service.load();
    const categories = data.categories.filter(
      (category) => category.tripId === trip.id,
    );
    expect(categories).toHaveLength(1);
    expect(
      data.stamps
        .filter((stamp) => stamp.categoryIds[0] === categories[0].id)
        .map((stamp) => stamp.name),
    ).toEqual(['海を見る', '山を見る']);
    const edited = await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...tripInput,
      name: '変更した旅行',
    });
    expect(edited.activityPresets).toEqual(['海']);
    expect(edited.customActivities).toEqual(['星空を見る']);
  });
  it('rejects invalid template or activity content without partially creating a trip', async () => {
    const service = createMockService(createDemoData(), 0);
    const before = await service.load();
    await expect(
      service.createTrip(DEMO_USER_ID, {
        ...tripInput,
        selectedCategories: [
          { name: '自然', stamps: [{ title: '海を見る' }, { title: '' }] },
        ],
      }),
    ).rejects.toThrow();
    await expect(
      service.createTrip(DEMO_USER_ID, {
        ...tripInput,
        customActivities: ['あ'.repeat(101)],
      }),
    ).rejects.toThrow('100');
    expect(await service.load()).toEqual(before);
  });
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
    const category = await service.createCategory(DEMO_USER_ID, {
      ...named,
      tripId: trip.id,
    });
    apply({ type: 'categorySaved', category });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      totalCategoryCount: 1,
      completedCategoryCount: 0,
      isCompleted: false,
    });
    const stamp = await service.createStamp(DEMO_USER_ID, {
      ...named,
      tripId: category.tripId,
      categoryIds: [category.id],
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
        categoryIds: [category.id],
        tripId: trip.id,
        mediaType: 'IMAGE',
        isFavorite: false,
        author: { id: DEMO_USER_ID },
      });
      expect(isUnreadPhoto(state.data!, DEMO_USER_ID, post)).toBe(false);
      expect(isUnreadPhoto(state.data!, initial.users[1].id, post)).toBe(true);
    }
    expect(
      state.data!.categories.find((g) => g.id === category.id),
    ).toMatchObject({
      totalStampCount: 1,
      completedStampCount: 1,
      isCompleted: true,
    });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      completedCategoryCount: 1,
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
    ).toEqual([
      'index',
      'trip/[tripId]',
      'category/[categoryId]',
      'stamp/[stampId]',
    ]);
    apply({ type: 'postsCreated', posts });
    expect(selectPhotos(state.data!, { stampId: stamp.id })).toHaveLength(2);
    const favorite = await service.setFavorite(posts[0].id, true);
    state = reducer(state, { type: 'favoriteUpdated', post: favorite });
    expect(
      selectPhotos(state.data!, { tripId: trip.id }, true).map((p) => p.id),
    ).toEqual([posts[0].id]);
    const another = await service.createStamp(DEMO_USER_ID, {
      ...named,
      tripId: category.tripId,
      categoryIds: [category.id],
    });
    apply({ type: 'stampSaved', stamp: another });
    expect(
      state.data!.categories.find((g) => g.id === category.id),
    ).toMatchObject({
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
    const emptyCategory = await service.createCategory(DEMO_USER_ID, {
      ...named,
      tripId: trip.id,
    });
    apply({ type: 'categorySaved', category: emptyCategory });
    expect(state.data!.trips.find((t) => t.id === trip.id)).toMatchObject({
      totalCategoryCount: 2,
      completedCategoryCount: 1,
      isCompleted: false,
    });
    expect(state.data).toEqual(await service.load());
  });

  it('updates editable fields, preserves relationships and retains writes across sign out', async () => {
    const service = createMockService(createDemoData(), 0);
    const snapshot = await service.load();
    const trip = snapshot.trips[0],
      category = snapshot.categories[0],
      stamp = snapshot.stamps[0];
    const updated = await service.updateTrip(DEMO_USER_ID, trip.id, {
      ...tripInput,
      name: '更新した旅',
      startDate: '2030-01-01',
      endDate: '2030-01-02',
      coverAssetId: '12345678-1234-4234-8234-123456789abc',
    });
    const newCategory = await service.updateCategory(
      DEMO_USER_ID,
      category.id,
      {
        name: '新カテゴリー',
        description: '',
      },
    );
    const newStamp = await service.updateStamp(DEMO_USER_ID, stamp.id, {
      name: '新スタンプ',
      description: '説明を更新',
    });
    expect(updated.createdAt).toBe(trip.createdAt);
    expect(newCategory.tripId).toBe(category.tripId);
    expect(newStamp.categoryIds[0]).toBe(stamp.categoryIds[0]);
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
    expect(after.categories[0].description).toBe('');
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
      service.createCategory(DEMO_USER_ID, {
        ...named,
        tripId: initial.trips[0].id,
      }),
    ).rejects.toThrow();
    await expect(
      service.createStamp(DEMO_USER_ID, {
        ...named,
        tripId: initial.categories[0].tripId,
        categoryIds: [initial.categories[0].id],
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
      service.updateCategory(DEMO_USER_ID, initial.categories[0].id, named),
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
