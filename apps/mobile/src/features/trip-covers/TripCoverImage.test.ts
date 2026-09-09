import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { QueryClientProvider, QueryObserver } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TripCoverImage } from './TripCoverImage';
import { createQueryClient } from '../app-data/api/queryClient';
import { resourceKey } from '../app-data/api/queries';
import { createDemoData } from '../app-data/mocks/fixtures';
import type { Trip } from '../trips/model/types';

const native = vi.hoisted(() => ({ request: vi.fn(), guard: vi.fn() }));
vi.mock('expo-router', () => ({ useIsFocused: () => true }));
vi.mock('../app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: 'viewer',
    client: { request: native.request, sessionGuard: () => native.guard },
  }),
}));
vi.mock('../../shared/ui/PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let cache: ReturnType<typeof createQueryClient>;
let renderer: ReactTestRenderer | undefined;
let unsubscribe: (() => void) | undefined;
const trip: Trip = {
  ...createDemoData().trips[0],
  coverImageUrl: 'https://storage.example/small.webp?X-Amz-Signature=old',
};
const fresh: Trip = {
  ...trip,
  coverImageUrl: 'https://storage.example/small.webp?X-Amz-Signature=new',
};

beforeEach(() => {
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  cache = createQueryClient();
  native.request.mockReset().mockResolvedValue(fresh);
  native.guard.mockReset();
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  unsubscribe?.();
  unsubscribe = undefined;
  cache.clear();
  vi.restoreAllMocks();
});

it.each(['list only', 'active detail'])(
  'invalidates an expired image URL with one request for %s',
  async (state) => {
    const queryKey = resourceKey('viewer', `/trips/${trip.id}`);
    if (state === 'active detail') {
      const observer = new QueryObserver(cache, {
        queryKey,
        initialData: trip,
        queryFn: () => native.request({ url: `/trips/${trip.id}` }),
      });
      unsubscribe = observer.subscribe(() => {});
    }
    const invalidate = vi.spyOn(cache, 'invalidateQueries');
    await act(async () => {
      renderer = create(
        createElement(
          QueryClientProvider,
          { client: cache },
          createElement(TripCoverImage, { trip }),
        ),
      );
    });
    expect(native.request).not.toHaveBeenCalled();
    let url: string | null = null;
    await act(async () => {
      url = await renderer!.root
        .findByType('PhotoImage' as never)
        .props.refresh();
    });
    expect(invalidate).toHaveBeenCalledWith(
      { queryKey, exact: true },
      { cancelRefetch: false },
    );
    expect(native.request).toHaveBeenCalledOnce();
    expect(url).toBe(fresh.coverImageUrl);
    expect(cache.getQueryData(queryKey)).toEqual(fresh);
  },
);
