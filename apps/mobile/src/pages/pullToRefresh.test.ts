import { createElement, type ComponentType } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { TripListScreen } from './trip-list/TripListScreen';
import { TripDetailScreen } from './trip-detail/TripDetailScreen';
import { GenreDetailScreen } from './genre-detail/GenreDetailScreen';
import { StampDetailScreen } from './stamp-detail/StampDetailScreen';
import { NotificationsScreen } from './notifications/NotificationsScreen';

const native = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({
    tripId: 'trip',
    genreId: 'genre',
    stampId: 'stamp',
  }),
  useRouter: () => ({}),
  useNavigation: () => ({}),
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  View: 'View',
  Pressable: 'Pressable',
  FlatList: 'FlatList',
  ScrollView: 'ScrollView',
  RefreshControl: 'RefreshControl',
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('../features/trips/hooks', () => ({
  useTrips: native.query,
  useTrip: native.query,
  useGenre: native.query,
  useStamp: native.query,
}));
vi.mock('../features/trips/navigation/useTripHeader', () => ({
  useTripHeader: () => {},
}));
vi.mock('../features/notifications/hooks', () => ({
  useNotifications: native.query,
}));
vi.mock('../features/app-data/AppDataProvider', () => ({
  useData: () => ({}),
}));
vi.mock('../features/photos/hooks/useRepresentativePhotos', () => ({
  useRepresentativePhotos: () => ({}),
}));
vi.mock('../features/uploads/UploadSummary', () => ({
  UploadSummary: 'UploadSummary',
}));
vi.mock('../features/uploads/UploadList', () => ({ UploadList: 'UploadList' }));
vi.mock('../features/photos/ui/PhotoTile', () => ({ PhotoTile: 'PhotoTile' }));
vi.mock('../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../shared/ui/EmptyState', () => ({ EmptyState: 'EmptyState' }));
vi.mock('../shared/ui/ErrorMessage', () => ({ ErrorMessage: 'ErrorMessage' }));
vi.mock('../shared/ui/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../shared/ui/PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('../shared/ui/QueryState', () => ({ QueryState: 'QueryState' }));
vi.mock('../shared/ui/SectionHeading', () => ({
  SectionHeading: 'SectionHeading',
}));
vi.mock('../shared/ui/StateView', () => ({ StateView: 'StateView' }));
vi.mock('../shared/ui/UnreadBadge', () => ({ UnreadBadge: 'UnreadBadge' }));
vi.mock('./trip-list/components/TripCard', () => ({ TripCard: 'TripCard' }));
vi.mock('./trip-list/components/CreateTripButton', () => ({
  CreateTripButton: 'CreateTripButton',
}));
vi.mock('./trip-detail/sections/FavoritePhotosSection', () => ({
  FavoritePhotosSection: 'FavoritePhotosSection',
}));
vi.mock('./trip-detail/sections/GenresSection', () => ({
  GenresSection: 'GenresSection',
}));
vi.mock('./trip-detail/sections/TripDetailHeader', () => ({
  TripDetailHeader: 'TripDetailHeader',
}));
vi.mock('./genre-detail/components/StampCard', () => ({
  StampCard: 'StampCard',
}));
vi.mock('./genre-detail/sections/GenreDetailHeader', () => ({
  GenreDetailHeader: 'GenreDetailHeader',
}));
vi.mock('./stamp-detail/components/CreatePostTile', () => ({
  CreatePostTile: 'CreatePostTile',
}));
vi.mock('./stamp-detail/sections/StampDetailHeader', () => ({
  StampDetailHeader: 'StampDetailHeader',
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function createQuery() {
  return {
    isPending: false,
    isFetching: false,
    isRefetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    error: null,
    data: {},
    invalidate: vi.fn().mockResolvedValue(undefined),
    fetchNextPage: vi.fn().mockResolvedValue(undefined),
    today: '2026-09-10',
    trip: { id: 'trip', name: 'Trip', coverImageUrl: null },
    genre: { id: 'genre', name: 'Genre' },
    stamp: { id: 'stamp', name: 'Stamp' },
    trips: [],
    genres: [],
    stamps: [],
    favorites: [],
    members: [],
    photos: [],
    notifications: [],
  };
}

let query: ReturnType<typeof createQuery>;
let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  query = createQuery();
  native.query.mockImplementation(() => query);
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

async function render(Screen: ComponentType) {
  await act(async () => {
    if (renderer) renderer.update(createElement(Screen));
    else renderer = create(createElement(Screen));
  });
}

const screens = [
  { name: 'trip list', Screen: TripListScreen, host: 'FlatList' },
  { name: 'trip detail', Screen: TripDetailScreen, host: 'ScrollView' },
  { name: 'genre detail', Screen: GenreDetailScreen, host: 'FlatList' },
  { name: 'stamp detail', Screen: StampDetailScreen, host: 'FlatList' },
  { name: 'notifications', Screen: NotificationsScreen, host: 'FlatList' },
];

it.each(screens)(
  '$name only shows refresh progress for a pull gesture',
  async ({ Screen, host }) => {
    const refreshProps = () => {
      const props = renderer!.root.findByType(host as never).props;
      return host === 'ScrollView' ? props.refreshControl.props : props;
    };

    // Initial loading and later background fetches must not start the native control.
    query.isPending = true;
    query.isFetching = true;
    await render(Screen);
    query.isPending = false;
    await render(Screen);
    expect(refreshProps().refreshing).toBe(false);

    for (const fetching of [false, true, false]) {
      query.isFetching = fetching;
      query.isRefetching = fetching;
      await render(Screen);
      expect(refreshProps().refreshing).toBe(false);
    }
    expect(query.invalidate).not.toHaveBeenCalled();

    // A pull during an existing background fetch owns its own progress state.
    query.isFetching = true;
    query.isRefetching = true;
    await render(Screen);
    const manual = Promise.withResolvers<void>();
    query.invalidate.mockReturnValueOnce(manual.promise);
    await act(async () => refreshProps().onRefresh());
    expect(query.invalidate).toHaveBeenCalledOnce();
    expect(refreshProps().refreshing).toBe(true);

    query.isFetching = false;
    query.isRefetching = false;
    await render(Screen);
    expect(refreshProps().refreshing).toBe(true);

    // Unrelated background work can continue after the manual request completes.
    query.isFetching = true;
    query.isRefetching = true;
    await render(Screen);
    await act(async () => manual.resolve());
    expect(refreshProps().refreshing).toBe(false);
  },
);

it('keeps notification pagination progress in the load-more button', async () => {
  query.hasNextPage = true;
  await render(NotificationsScreen);
  const list = () => renderer!.root.findByType('FlatList' as never);
  await act(async () => list().props.ListFooterComponent.props.onPress());
  expect(query.fetchNextPage).toHaveBeenCalledOnce();
  expect(query.invalidate).not.toHaveBeenCalled();

  query.isFetching = true;
  query.isFetchingNextPage = true;
  await render(NotificationsScreen);
  expect(list().props.ListFooterComponent.props.pending).toBe(true);
  expect(list().props.refreshing).toBe(false);
});
