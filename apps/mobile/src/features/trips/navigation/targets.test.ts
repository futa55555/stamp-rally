import { describe, expect, it, vi } from 'vitest';
import { resolveApiTarget } from './targets';

describe('API navigation hierarchy', () => {
  it.each(['memory', 'removed', undefined])(
    'preserves a valid entry genre and otherwise falls back for %s',
    async (preferred) => {
      const data: Record<string, unknown> = {
        '/stamps/shared': {
          id: 'shared',
          tripId: 'trip',
          genreIds: ['view', 'memory'],
          name: '夜景',
        },
        '/genres/view': { id: 'view', tripId: 'trip', name: '景色' },
        '/genres/memory': { id: 'memory', tripId: 'trip', name: '思い出' },
        '/trips/trip': { id: 'trip', name: '旅' },
      };
      const request = vi.fn(
        async ({ url }: { url: string }) => data[url],
      ) as never;
      const routes = await resolveApiTarget(
        { request },
        { type: 'stamp', stampId: 'shared' },
        preferred,
      );
      const expected = preferred === 'memory' ? 'memory' : 'view';
      expect(routes[2].params).toMatchObject({ genreId: expected });
      expect(routes[3].params).toMatchObject({
        stampId: 'shared',
        viaGenreId: expected,
      });
    },
  );
  it.each(['photo', 'video'] as const)(
    'fetches a %s and every missing ancestor to build the back stack',
    async (type) => {
      const request = vi
        .fn()
        .mockResolvedValueOnce({
          id: 'photo',
          stampId: 'stamp',
          mediaType: type === 'video' ? 'VIDEO' : 'IMAGE',
        })
        .mockResolvedValueOnce({
          id: 'stamp',
          tripId: 'trip',
          genreIds: ['genre'],
          name: '朝の散歩',
        })
        .mockResolvedValueOnce({
          id: 'genre',
          tripId: 'trip',
          name: 'まち歩き',
        })
        .mockResolvedValueOnce({ id: 'trip', name: '京都旅行' });
      expect(
        await resolveApiTarget({ request }, { type, postId: 'photo' }),
      ).toEqual([
        { name: 'index', params: undefined },
        {
          name: 'trip/[tripId]',
          params: { tripId: 'trip', title: '京都旅行' },
        },
        {
          name: 'genre/[genreId]',
          params: { genreId: 'genre', title: 'まち歩き' },
        },
        {
          name: 'stamp/[stampId]',
          params: { stampId: 'stamp', title: '朝の散歩', viaGenreId: 'genre' },
        },
        {
          name: 'photo/[postId]',
          params: { postId: 'photo', viaGenreId: 'genre' },
        },
      ]);
      expect(request.mock.calls.map(([config]) => config.url)).toEqual([
        '/posts/photo',
        '/stamps/stamp',
        '/genres/genre',
        '/trips/trip',
      ]);
    },
  );
  it('propagates unavailable parents so callers can show a retryable error', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'stamp',
        tripId: 'trip',
        genreIds: ['genre'],
      })
      .mockRejectedValueOnce(new Error('404'));
    await expect(
      resolveApiTarget({ request }, { type: 'stamp', stampId: 'stamp' }),
    ).rejects.toThrow('404');
  });
});
