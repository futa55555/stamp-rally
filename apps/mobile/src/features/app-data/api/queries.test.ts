import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import {
  focusManager,
  onlineManager,
  QueryClientProvider,
} from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './queryClient';
import { resourceKey, useDetail } from './queries';
import { useNotifications } from '../../notifications/hooks';

const native = vi.hoisted(() => ({ focused: true, request: vi.fn() }));
vi.mock('expo-router', () => ({ useIsFocused: () => native.focused }));
vi.mock('../AppDataProvider', () => ({
  useData: () => ({
    userId: 'viewer',
    user: { status: 'ACTIVE' },
    client: { request: native.request },
  }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let cache: ReturnType<typeof createQueryClient>;
let renderer: ReactTestRenderer | undefined;
let now: number;
let result: { invalidate: () => Promise<unknown>; data: unknown };

beforeEach(() => {
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  now = Date.now();
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  native.focused = true;
  native.request
    .mockReset()
    .mockResolvedValue({ items: [], nextCursor: null, unreadCount: 0 });
  focusManager.setFocused(true);
  onlineManager.setOnline(true);
  cache = createQueryClient();
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  cache.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
});

const subjects = [
  {
    name: 'resource',
    key: resourceKey('viewer', '/posts/photo'),
    useQuery: () => useDetail('/posts/photo', true),
  },
  {
    name: 'notifications',
    key: resourceKey('viewer', '/notifications', { limit: 20 }),
    useQuery: useNotifications,
  },
];

describe.each(subjects)('$name cache policy', ({ key, useQuery }) => {
  function Screen() {
    result = useQuery();
    return null;
  }
  async function render() {
    await act(async () => {
      const element = createElement(
        QueryClientProvider,
        { client: cache },
        createElement(Screen),
      );
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
    await settle();
  }
  async function settle() {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it('reuses fresh data on screen return and remount, and fetches expired data', async () => {
    await render();
    expect(native.request).toHaveBeenCalledTimes(1);
    const data = result.data;

    native.focused = false;
    await render();
    now += 2000;
    native.focused = true;
    await render();
    expect(result.data).toEqual(data);
    expect(native.request).toHaveBeenCalledTimes(1);

    await act(async () => renderer!.unmount());
    renderer = undefined;
    await render();
    expect(native.request).toHaveBeenCalledTimes(1);

    native.focused = false;
    await render();
    now += 30001;
    native.focused = true;
    await render();
    expect(native.request).toHaveBeenCalledTimes(2);
  });

  it('reuses fresh data on app focus and reconnect, and fetches stale data', async () => {
    await render();
    for (const manager of [focusManager, onlineManager]) {
      const set =
        manager === focusManager
          ? (value: boolean) => focusManager.setFocused(value)
          : (value: boolean) => onlineManager.setOnline(value);
      await act(async () => set(false));
      await act(async () => set(true));
      await settle();
      expect(native.request).toHaveBeenCalledTimes(
        manager === focusManager ? 1 : 2,
      );

      now += 30001;
      await act(async () => set(false));
      await act(async () => set(true));
      await settle();
      expect(native.request).toHaveBeenCalledTimes(
        manager === focusManager ? 2 : 3,
      );
    }
  });

  it('fetches after invalidation while focused and defers hidden queries until return', async () => {
    await render();
    await act(async () => {
      await result.invalidate();
    });
    await settle();
    expect(native.request).toHaveBeenCalledTimes(2);

    native.focused = false;
    await render();
    await act(async () =>
      cache.invalidateQueries({ queryKey: key, exact: true }),
    );
    expect(native.request).toHaveBeenCalledTimes(2);
    expect(cache.getQueryState(key)?.isInvalidated).toBe(true);

    native.focused = true;
    await render();
    expect(native.request).toHaveBeenCalledTimes(3);
    expect(cache.getQueryState(key)?.isInvalidated).toBe(false);
  });
});
