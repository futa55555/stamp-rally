import { describe, expect, it } from 'vitest';
import { createDemoData, DEMO_USER_ID } from './fixtures';
import { dateLabel, localDate, offsetDate } from './dates';
import {
  hasUnreadPhotos,
  isActiveTrip,
  isUnreadPhoto,
  selectPhotos,
  sortTrips,
  validateName,
} from './selectors';
import { reducer, initialState } from './reducer';
import { createMockService } from './service';
import { resolveTarget } from '../navigation/targets';

const now = new Date(2026, 8, 8, 9, 0);
const fixture = () => createDemoData(now);

describe('calendar dates and trip order', () => {
  it('uses local calendar dates and includes both boundaries', () => {
    const trip = {
      ...fixture().trips[0],
      startDate: '2026-09-08',
      endDate: '2026-09-08',
    };
    expect(localDate(now)).toBe('2026-09-08');
    expect(isActiveTrip(trip, '2026-09-08')).toBe(true);
    expect(isActiveTrip(trip, '2026-09-07')).toBe(false);
    expect(isActiveTrip(trip, '2026-09-09')).toBe(false);
    expect(offsetDate(new Date(2026, 11, 31), 1)).toBe('2027-01-01');
    expect(dateLabel('2026-09-08')).toBe('2026年9月8日');
  });

  it('puts all active trips first, then orders each group by creation date', () => {
    const data = fixture();
    const newerActive = {
      ...data.trips[0],
      id: 'new-active',
      createdAt: now.toISOString(),
    };
    const input = [data.trips[1], data.trips[2], data.trips[0], newerActive];
    expect(sortTrips(input, '2026-09-08').map((t) => t.id)).toEqual([
      newerActive.id,
      data.trips[0].id,
      data.trips[2].id,
      data.trips[1].id,
    ]);
    expect(input[0]).toBe(data.trips[1]);
  });

  it('uses a deterministic tie break and keeps active fixtures relative to launch', () => {
    const data = fixture();
    const a = { ...data.trips[0], id: 'a' };
    const b = { ...a, id: 'b' };
    expect(sortTrips([a, b], '2026-09-08').map((t) => t.id)).toEqual([
      'b',
      'a',
    ]);
    const future = createDemoData(new Date(2030, 0, 1));
    expect(future.trips.some((t) => isActiveTrip(t, '2030-01-01'))).toBe(true);
  });
});

describe('read state and shared favorites', () => {
  it('marks only the viewed photo and aggregates remaining unread photos', () => {
    const data = fixture();
    const [first, second] = data.posts;
    data.readPhotoIds[DEMO_USER_ID] = [];
    const before = { ...initialState, data, userId: DEMO_USER_ID };
    const after = reducer(before, {
      type: 'photoRead',
      userId: DEMO_USER_ID,
      postId: first.id,
    });
    expect(isUnreadPhoto(after.data!, DEMO_USER_ID, first)).toBe(false);
    expect(isUnreadPhoto(after.data!, DEMO_USER_ID, second)).toBe(true);
    expect(
      hasUnreadPhotos(after.data!, DEMO_USER_ID, { stampId: first.stampId }),
    ).toBe(true);
    const complete = reducer(after, {
      type: 'photoRead',
      userId: DEMO_USER_ID,
      postId: second.id,
    });
    expect(
      hasUnreadPhotos(complete.data!, DEMO_USER_ID, { stampId: first.stampId }),
    ).toBe(false);
    expect(
      hasUnreadPhotos(complete.data!, DEMO_USER_ID, { genreId: first.genreId }),
    ).toBe(true);
    expect(before.data.readPhotoIds[DEMO_USER_ID]).toEqual([]);
  });

  it('excludes own photos and videos, and isolates read state by user', () => {
    const data = fixture();
    const own = data.posts.find((p) => p.author.id === DEMO_USER_ID)!;
    const other = data.posts[0];
    expect(isUnreadPhoto(data, DEMO_USER_ID, own)).toBe(false);
    expect(
      isUnreadPhoto(data, DEMO_USER_ID, { ...other, mediaType: 'VIDEO' }),
    ).toBe(false);
    const after = reducer(
      { ...initialState, data },
      { type: 'photoRead', userId: DEMO_USER_ID, postId: other.id },
    );
    expect(isUnreadPhoto(after.data!, data.users[2].id, other)).toBe(true);
    expect(
      reducer(after, {
        type: 'photoRead',
        userId: DEMO_USER_ID,
        postId: other.id,
      }).data?.readPhotoIds[DEMO_USER_ID].filter((id) => id === other.id),
    ).toHaveLength(1);
  });

  it('keeps notification reads independent from photo reads', () => {
    const data = fixture();
    const state = reducer(
      { ...initialState, data },
      {
        type: 'notificationRead',
        notification: { ...data.notifications[0], readAt: now.toISOString() },
      },
    );
    expect(state.data?.notifications[0].readAt).toBe(now.toISOString());
    expect(isUnreadPhoto(state.data!, DEMO_USER_ID, data.posts[0])).toBe(true);
    const photoRead = reducer(
      { ...initialState, data },
      { type: 'photoRead', userId: DEMO_USER_ID, postId: data.posts[0].id },
    );
    expect(photoRead.data?.notifications[0].readAt).toBeNull();
  });

  it('reflects multiple favorites in both stamp photos and trip moments', async () => {
    const data = fixture();
    const service = createMockService(data, 0);
    let state = { ...initialState, data, userId: DEMO_USER_ID };
    const photo = data.posts[2];
    const changed = await service.setFavorite(photo.id, true);
    state = reducer(state, {
      type: 'favoriteUpdated',
      post: changed,
    }) as typeof state;
    expect(
      selectPhotos(state.data, { stampId: photo.stampId }, true),
    ).toHaveLength(3);
    expect(
      selectPhotos(state.data, { tripId: photo.tripId }, true).some(
        (p) => p.id === photo.id,
      ),
    ).toBe(true);
    const removed = await service.setFavorite(photo.id, false);
    state = reducer(state, {
      type: 'favoriteUpdated',
      post: removed,
    }) as typeof state;
    expect(
      selectPhotos(state.data, { tripId: photo.tripId }, true).some(
        (p) => p.id === photo.id,
      ),
    ).toBe(false);
    expect(selectPhotos(state.data, { stampId: photo.stampId })).toHaveLength(
      3,
    );
    expect(data.posts[2].isFavorite).toBe(false);
  });
});

describe('profile and mock session', () => {
  it('validates Unicode length, trimming, uniqueness and unchanged names', () => {
    const users = fixture().users;
    expect(validateName('  新しい 名前  ', DEMO_USER_ID, users)).toBe(
      '新しい 名前',
    );
    expect(validateName('はる', DEMO_USER_ID, users)).toBe('はる');
    expect(validateName('🌿'.repeat(20), DEMO_USER_ID, users)).toHaveLength(40);
    expect(() => validateName('🌿'.repeat(21), DEMO_USER_ID, users)).toThrow(
      '1〜20',
    );
    expect(() => validateName(' \n ', DEMO_USER_ID, users)).toThrow('1〜20');
    expect(() => validateName(' あおい ', DEMO_USER_ID, users)).toThrow(
      'すでに',
    );
  });

  it('updates author display names without rewriting posts and retains edits across sign out', async () => {
    const data = fixture();
    const service = createMockService(data, 0);
    const user = await service.updateName(DEMO_USER_ID, ' 春 ');
    let state = reducer(
      { ...initialState, data, userId: DEMO_USER_ID },
      { type: 'nameUpdated', user },
    );
    const own = data.posts.find((p) => p.author.id === DEMO_USER_ID)!;
    expect(
      selectPhotos(state.data!, { stampId: own.stampId }).find(
        (p) => p.id === own.id,
      )?.author.name,
    ).toBe('春');
    await service.signOut();
    state = reducer(state, { type: 'signedOut' });
    expect(state.userId).toBeNull();
    state = reducer(state, {
      type: 'signedIn',
      userId: await service.signIn('apple'),
    });
    expect(state.data?.users[0].name).toBe('春');
    expect((await createMockService(data, 0).load()).users[0].name).toBe(
      'はる',
    );
  });

  it('reports invalid updates and does not mutate previously returned data', async () => {
    const service = createMockService(fixture(), 0);
    const snapshot = await service.load();
    await expect(service.updateName(DEMO_USER_ID, 'あおい')).rejects.toThrow(
      'すでに',
    );
    await expect(service.setFavorite('missing', true)).rejects.toThrow(
      '見つかりません',
    );
    await service.markPhotoRead(DEMO_USER_ID, snapshot.posts[0].id);
    await service.markNotificationRead(snapshot.notifications[0].id);
    expect(snapshot.notifications[0].readAt).toBeNull();
    expect(snapshot.readPhotoIds[DEMO_USER_ID]).not.toContain(
      snapshot.posts[0].id,
    );
    const updated = await service.load();
    expect(updated.readPhotoIds[DEMO_USER_ID]).toContain(snapshot.posts[0].id);
    expect(updated.notifications[0].readAt).not.toBeNull();
  });
});

describe('notification navigation', () => {
  it('constructs the full parent stack for a photo', () => {
    const data = fixture();
    const photo = data.posts[0];
    expect(
      resolveTarget(data, { type: 'photo', postId: photo.id }, DEMO_USER_ID),
    ).toEqual([
      { name: 'index', params: undefined },
      { name: 'trip/[tripId]', params: { tripId: photo.tripId } },
      { name: 'genre/[genreId]', params: { genreId: photo.genreId } },
      { name: 'stamp/[stampId]', params: { stampId: photo.stampId } },
      { name: 'photo/[postId]', params: { postId: photo.id } },
    ]);
  });

  it('resolves every supported destination', () => {
    const data = fixture();
    expect(
      data.notifications.map(
        (n) => resolveTarget(data, n.target, DEMO_USER_ID)?.at(-1)?.name,
      ),
    ).toEqual([
      'photo/[postId]',
      'stamp/[stampId]',
      'trip/[tripId]',
      'genre/[genreId]',
    ]);
  });

  it('rejects missing resources, broken ancestry, videos and inaccessible trips', () => {
    const data = fixture();
    expect(
      resolveTarget(data, { type: 'photo', postId: 'missing' }, DEMO_USER_ID),
    ).toBeNull();
    expect(
      resolveTarget(data, data.notifications[0].target, 'outsider'),
    ).toBeNull();
    expect(
      resolveTarget(
        { ...data, stamps: [] },
        data.notifications[0].target,
        DEMO_USER_ID,
      ),
    ).toBeNull();
    data.posts[0].mediaType = 'VIDEO';
    expect(
      resolveTarget(data, data.notifications[0].target, DEMO_USER_ID),
    ).toBeNull();
  });
});
