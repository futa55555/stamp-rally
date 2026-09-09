import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { usePullToRefresh } from './usePullToRefresh';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let refresh: ReturnType<typeof usePullToRefresh>;

beforeEach(() => {
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

function Harness({ refetch }: { refetch: () => Promise<unknown> }) {
  refresh = usePullToRefresh(refetch);
  return null;
}

async function mount(refetch: () => Promise<unknown>) {
  await act(async () => {
    renderer = create(createElement(Harness, { refetch }));
  });
}

it('waits for every query in a manual refresh and ignores repeated pulls', async () => {
  const first = Promise.withResolvers<void>();
  const last = Promise.withResolvers<void>();
  const refetch = vi.fn(() => Promise.all([first.promise, last.promise]));
  await mount(refetch);
  expect(refresh.refreshing).toBe(false);

  await act(async () => {
    refresh.onRefresh();
    refresh.onRefresh();
  });
  expect(refetch).toHaveBeenCalledOnce();
  expect(refresh.refreshing).toBe(true);

  await act(async () => first.resolve());
  expect(refresh.refreshing).toBe(true);
  await act(async () => last.resolve());
  expect(refresh.refreshing).toBe(false);

  await act(async () => refresh.onRefresh());
  expect(refetch).toHaveBeenCalledTimes(2);
  expect(refresh.refreshing).toBe(false);
});

it('stops after a failed refresh and allows retrying', async () => {
  const failed = Promise.withResolvers<void>();
  const retry = Promise.withResolvers<void>();
  const refetch = vi
    .fn()
    .mockReturnValueOnce(failed.promise)
    .mockReturnValueOnce(retry.promise);
  await mount(refetch);
  await act(async () => refresh.onRefresh());
  expect(refresh.refreshing).toBe(true);

  await act(async () => failed.reject(new Error('Network unavailable')));
  expect(refresh.refreshing).toBe(false);
  await act(async () => refresh.onRefresh());
  expect(refetch).toHaveBeenCalledTimes(2);
  expect(refresh.refreshing).toBe(true);
  await act(async () => retry.resolve());
  expect(refresh.refreshing).toBe(false);
});

it('uses the current refetch callback after rerendering', async () => {
  const previous = vi.fn().mockResolvedValue(undefined);
  const current = vi.fn().mockResolvedValue(undefined);
  await mount(previous);
  await act(async () => {
    renderer!.update(createElement(Harness, { refetch: current }));
  });
  await act(async () => refresh.onRefresh());
  expect(previous).not.toHaveBeenCalled();
  expect(current).toHaveBeenCalledOnce();
});

it('keeps completion after unmount separate from a new screen refresh', async () => {
  const previous = Promise.withResolvers<void>();
  await mount(() => previous.promise);
  await act(async () => refresh.onRefresh());
  await act(async () => renderer!.unmount());

  const current = Promise.withResolvers<void>();
  await mount(() => current.promise);
  expect(refresh.refreshing).toBe(false);
  await act(async () => refresh.onRefresh());
  await act(async () => previous.reject(new Error('Old request failed')));
  expect(refresh.refreshing).toBe(true);
  await act(async () => current.resolve());
  expect(refresh.refreshing).toBe(false);
});
