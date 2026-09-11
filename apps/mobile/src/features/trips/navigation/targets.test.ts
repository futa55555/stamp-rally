import { describe, expect, it, vi } from 'vitest';
import { resolveApiTarget } from './targets';

describe('API navigation hierarchy', () => {
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
          genreId: 'genre',
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
          params: { stampId: 'stamp', title: '朝の散歩' },
        },
        { name: 'photo/[postId]', params: { postId: 'photo' } },
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
      .mockResolvedValueOnce({ id: 'stamp', genreId: 'genre' })
      .mockRejectedValueOnce(new Error('404'));
    await expect(
      resolveApiTarget({ request }, { type: 'stamp', stampId: 'stamp' }),
    ).rejects.toThrow('404');
  });
});
