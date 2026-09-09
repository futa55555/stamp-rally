import { describe, expect, it, vi } from 'vitest';
import { resolveApiTarget } from './targets';

describe('API navigation hierarchy', () => {
  it('fetches a photo and every missing ancestor to build the back stack', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'photo',
        stampId: 'stamp',
        mediaType: 'IMAGE',
      })
      .mockResolvedValueOnce({ id: 'stamp', genreId: 'genre' })
      .mockResolvedValueOnce({ id: 'genre', tripId: 'trip' })
      .mockResolvedValueOnce({ id: 'trip' });
    expect(
      await resolveApiTarget({ request }, { type: 'photo', postId: 'photo' }),
    ).toEqual([
      { name: 'index', params: undefined },
      { name: 'trip/[tripId]', params: { tripId: 'trip' } },
      { name: 'genre/[genreId]', params: { genreId: 'genre' } },
      { name: 'stamp/[stampId]', params: { stampId: 'stamp' } },
      { name: 'photo/[postId]', params: { postId: 'photo' } },
    ]);
    expect(request.mock.calls.map(([config]) => config.url)).toEqual([
      '/posts/photo',
      '/stamps/stamp',
      '/genres/genre',
      '/trips/trip',
    ]);
  });
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
