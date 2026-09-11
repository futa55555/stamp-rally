import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDemoData } from '../../app-data/mocks/fixtures';
import { useTripHeader } from './useTripHeader';

const native = vi.hoisted(() => ({
  navigation: { setOptions: vi.fn(), getState: vi.fn(), dispatch: vi.fn() },
  router: { push: vi.fn() },
  focused: vi.fn(),
}));
vi.mock('expo-router', () => ({
  useNavigation: () => native.navigation,
  useRouter: () => native.router,
  useIsFocused: native.focused,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('../../../shared/ui/IconButton', () => ({ IconButton: 'IconButton' }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const data = createDemoData();
const trip = data.trips[0];
const genre = data.genres.find((item) => item.tripId === trip.id)!;
const stamp = data.stamps.find((item) => item.genreIds.includes(genre.id))!;
const index = { name: 'index', key: 'list-key' };
const tripRoute = {
  name: 'trip/[tripId]',
  key: 'trip-key',
  params: { tripId: trip.id },
};
const genreRoute = {
  name: 'genre/[genreId]',
  key: 'genre-key',
  params: { genreId: genre.id },
};
const stampRoute = {
  name: 'stamp/[stampId]',
  key: 'stamp-key',
  params: { stampId: stamp.id },
};
let renderer: ReactTestRenderer | undefined;

function Header(props: Parameters<typeof useTripHeader>[0]) {
  useTripHeader(props);
  return null;
}
async function render(props: Parameters<typeof useTripHeader>[0]) {
  await act(async () => {
    renderer = create(createElement(Header, props));
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  native.focused.mockReturnValue(true);
  native.navigation.getState.mockReturnValue({
    index: 3,
    routes: [index, tripRoute, genreRoute, stampRoute],
  });
  const original = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (!String(args[0]).startsWith('react-test-renderer is deprecated'))
      original(...args);
  });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

it('shows the current stamp title, leaves Back to the native stack, and preserves contextual posting', async () => {
  await render({ title: stamp.name, trip, genre, stamp });
  const options = native.navigation.setOptions.mock.lastCall![0];
  expect(options.title).toBe(stamp.name);
  expect(options.headerBackTitle).toBeUndefined();
  expect(options.headerLeft).toBeUndefined();
  const [post] = options.unstable_headerRightItems();
  expect(post.icon).toEqual({ type: 'sfSymbol', name: 'plus' });
  expect(post.label).toBe('');
  expect(post.accessibilityLabel).toBe('投稿を追加');
  post.onPress();
  expect(native.router.push).toHaveBeenCalledWith({
    pathname: '/editor/post',
    params: {
      initialTripId: trip.id,
      initialGenreId: genre.id,
      initialStampId: stamp.id,
    },
  });
  expect(native.navigation.dispatch).not.toHaveBeenCalled();
});

it('inserts named ancestors for a directly linked stamp while retaining the current route and list', async () => {
  native.navigation.getState.mockReturnValue({
    index: 1,
    routes: [index, stampRoute],
  });
  await render({ title: stamp.name, trip, genre, stamp });
  expect(native.navigation.dispatch).toHaveBeenCalledExactlyOnceWith({
    type: 'RESET',
    payload: {
      index: 3,
      routes: [
        index,
        {
          name: 'trip/[tripId]',
          params: { tripId: trip.id, title: trip.name },
        },
        {
          name: 'genre/[genreId]',
          params: { genreId: genre.id, title: genre.name },
        },
        stampRoute,
      ],
    },
  });
});

it('gives a directly linked genre a native back path through the trip and list', async () => {
  native.navigation.getState.mockReturnValue({
    index: 0,
    routes: [genreRoute],
  });
  await render({ title: genre.name, trip, genre });
  expect(native.navigation.setOptions.mock.lastCall![0].title).toBe(genre.name);
  expect(native.navigation.dispatch.mock.lastCall![0].payload).toEqual({
    index: 2,
    routes: [
      { name: 'index', params: undefined },
      { name: 'trip/[tripId]', params: { tripId: trip.id, title: trip.name } },
      genreRoute,
    ],
  });
});

it('preserves existing navigation history even when it differs from the entity hierarchy', async () => {
  const previous = { ...tripRoute, params: { tripId: 'another-trip' } };
  native.navigation.getState.mockReturnValue({
    index: 2,
    routes: [index, previous, genreRoute],
  });
  await render({ title: genre.name, trip, genre });
  expect(native.navigation.dispatch).not.toHaveBeenCalled();
});

it('does not rewrite the active stack from an unfocused screen or before ancestors load', async () => {
  native.navigation.getState.mockReturnValue({
    index: 0,
    routes: [stampRoute],
  });
  native.focused.mockReturnValue(false);
  await render({ title: stamp.name, trip, genre, stamp });
  expect(native.navigation.dispatch).not.toHaveBeenCalled();
  native.focused.mockReturnValue(true);
  await act(async () =>
    renderer!.update(
      createElement(Header, { title: 'スタンプ', stampId: stamp.id }),
    ),
  );
  expect(native.navigation.dispatch).not.toHaveBeenCalled();
});
