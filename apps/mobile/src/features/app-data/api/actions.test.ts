import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { createActions } from './actions';
import type { SessionClient } from './SessionClient';

function setup() {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const request = vi.fn();
  const guard = vi.fn();
  const client = {
    request,
    snapshot: () => ({ user: { id: 'viewer' } }),
    sessionGuard: () => guard,
  } as unknown as SessionClient;
  return {
    cache,
    request,
    guard,
    actions: createActions(client, cache, 'viewer'),
  };
}
describe('API mutations', () => {
  it('updates post detail and invalidates the current user’s lists and aggregates', async () => {
    const { cache, request, actions } = setup();
    const post = { id: 'photo', isFavorite: true, readAt: null };
    const favorites = [
      'user',
      'viewer',
      '/posts',
      { tripId: 'trip', favoritesOnly: true, mediaType: 'IMAGE' },
    ];
    const category = ['user', 'viewer', '/categories/category', {}];
    const other = ['user', 'other', '/posts', {}];
    for (const key of [favorites, category, other]) cache.setQueryData(key, []);
    request.mockResolvedValue(post);
    await actions.setFavorite('photo', true);
    expect(cache.getQueryData(['user', 'viewer', '/posts/photo', {}])).toEqual(
      post,
    );
    expect(cache.getQueryState(favorites)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(category)?.isInvalidated).toBe(true);
    expect(cache.getQueryState(other)?.isInvalidated).toBe(false);
    expect(request).toHaveBeenCalledWith({
      method: 'PATCH',
      url: '/posts/photo/favorite',
      data: { isFavorite: true },
    });
    cache.clear();
  });
  it('sends deletions and independently targets photo and notification read endpoints', async () => {
    const { actions, request, cache } = setup();
    request.mockResolvedValue(undefined);
    await actions.markPhotoRead('viewer', 'photo');
    await actions.markNotificationRead('notification');
    await actions.deletePost('viewer', 'photo');
    expect(
      request.mock.calls.map(([config]) => [config.method, config.url]),
    ).toEqual([
      ['PATCH', '/posts/photo/read'],
      ['PATCH', '/notifications/notification/read'],
      ['DELETE', '/posts/photo'],
    ]);
    cache.clear();
  });
  it('never sends device-local cover URIs and supports explicit clearing', async () => {
    const { actions, request, cache } = setup();
    const input = {
      name: '旅行',
      startDate: '2026-09-09',
      endDate: '2026-09-10',
      locations: [],
      coverImageUrl: 'file:///image.jpg',
    };
    await actions.createTrip('viewer', input);
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          name: input.name,
          locations: [],
          startDate: input.startDate,
          endDate: input.endDate,
        },
      }),
    );
    await actions.updateTrip('viewer', 'trip', {
      ...input,
      coverAssetId: null,
    });
    expect(request).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: {
          name: input.name,
          locations: [],
          startDate: input.startDate,
          endDate: input.endDate,
          coverAssetId: null,
        },
      }),
    );
    cache.clear();
  });
  it('rejects a successful response from a session that was logged out before cache publication', async () => {
    const { actions, request, guard, cache } = setup();
    request.mockImplementation(async () => {
      guard.mockImplementation(() => {
        throw new Error('Session changed');
      });
      return { id: 'photo' };
    });
    await expect(actions.setFavorite('photo', true)).rejects.toThrow(
      'Session changed',
    );
    expect(cache.getQueryCache().getAll()).toEqual([]);
    cache.clear();
  });
  it('sends activity and template selections on create while keeping trip updates unchanged', async () => {
    const { actions, request, cache } = setup();
    const input = {
      name: '旅行',
      startDate: '2026-09-09',
      endDate: '2026-09-10',
      locations: ['沖縄'],
      activityPresets: ['海'],
      customActivities: ['星空を見る'],
      selectedCategories: [{ name: '自然', stamps: [{ title: '海を見る' }] }],
      clientRequestId: 'request-id',
    };
    await actions.createTrip('viewer', input);
    expect(request).toHaveBeenLastCalledWith({
      method: 'POST',
      url: '/trips',
      data: input,
    });
    await actions.updateTrip('viewer', 'trip', input);
    expect(request).toHaveBeenLastCalledWith({
      method: 'PATCH',
      url: '/trips/trip',
      data: {
        name: '旅行',
        startDate: '2026-09-09',
        endDate: '2026-09-10',
        locations: ['沖縄'],
      },
    });
    cache.clear();
  });
});
