import { describe, expect, it, vi } from 'vitest';
import { allPages } from './pagination';

describe('complete resource lists', () => {
  it('follows more than 100 items through the terminal cursor with filters and cancellation', async () => {
    const signal = new AbortController().signal;
    const request = vi
      .fn()
      .mockResolvedValueOnce({
        items: Array.from({ length: 100 }, (_, id) => id),
        nextCursor: 'second',
      })
      .mockResolvedValueOnce({ items: [100, 101], nextCursor: null });
    expect(
      await allPages(
        { request },
        '/posts',
        { categoryId: 'category', mediaType: 'IMAGE' },
        signal,
      ),
    ).toHaveLength(102);
    expect(request).toHaveBeenLastCalledWith({
      url: '/posts',
      params: {
        categoryId: 'category',
        mediaType: 'IMAGE',
        limit: 100,
        cursor: 'second',
      },
      signal,
    });
  });
  it('does not expose partial candidates if a later page fails', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ items: ['first'], nextCursor: 'next' })
      .mockRejectedValueOnce(new Error('offline'));
    await expect(allPages({ request }, '/posts', {})).rejects.toThrow(
      'offline',
    );
  });
  it('stops malformed repeating cursors', async () => {
    const request = vi
      .fn()
      .mockResolvedValue({ items: [], nextCursor: 'same' });
    await expect(allPages({ request }, '/posts', {})).rejects.toThrow('ページ');
    expect(request).toHaveBeenCalledTimes(2);
  });
});
