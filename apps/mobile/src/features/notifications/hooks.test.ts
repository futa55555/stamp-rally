import { createElement, useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useNotifications } from './hooks';
const native = vi.hoisted(() => ({ request: vi.fn(), userId: 'viewer' }));
vi.mock('../app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: native.userId,
    user: { status: 'ACTIVE' },
    client: { request: native.request },
  }),
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void) => useEffect(callback, [callback]),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('uses the global API badge count across notification pages and separates users', async () => {
  const warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  native.userId = 'viewer';
  native.request
    .mockReset()
    .mockResolvedValueOnce({
      items: [{ id: 'n1', readAt: null }],
      nextCursor: 'next',
      unreadCount: 42,
    })
    .mockResolvedValueOnce({
      items: [{ id: 'n2', readAt: null }],
      nextCursor: null,
      unreadCount: 42,
    });
  let result!: ReturnType<typeof useNotifications>;
  function Screen() {
    result = useNotifications();
    return null;
  }
  let view!: ReturnType<typeof create>;
  try {
    await act(async () => {
      view = create(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(Screen),
        ),
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.notifications).toHaveLength(1);
    expect(result.unreadCount).toBe(42);
    await act(async () => {
      await result.fetchNextPage();
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.notifications.map((item) => item.id)).toEqual(['n1', 'n2']);
    expect(result.unreadCount).toBe(42);
    expect(result.hasNextPage).toBe(false);
    native.userId = 'different-user';
    native.request.mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 0,
    });
    await act(async () =>
      view.update(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(Screen),
        ),
      ),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    expect(result.notifications).toEqual([]);
    expect(result.unreadCount).toBe(0);
    await act(async () => view.unmount());
  } finally {
    cache.clear();
    warning.mockRestore();
  }
});
