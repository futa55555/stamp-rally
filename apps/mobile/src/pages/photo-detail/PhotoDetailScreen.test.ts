import { createElement, Fragment, type ReactNode } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_USER_ID,
  createDemoData,
} from '../../features/app-data/mocks/fixtures';
import type { AppData } from '../../features/app-data/model/types';
import type { Post } from '../../features/photos/model/types';
import { selectPhotos } from '../../features/photos/model/selectors';
import type { TripStackParamList } from '../../features/trips/navigation/types';
import { PhotoDetailScreen } from './PhotoDetailScreen';

const native = vi.hoisted(() => ({
  alert: vi.fn(),
  params: vi.fn(),
  data: vi.fn(),
  focused: vi.fn(),
  canGoBack: vi.fn(),
  back: vi.fn(),
  replace: vi.fn(),
  share: vi.fn(),
  save: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: native.params,
  useIsFocused: native.focused,
  useNavigation: () => ({ isFocused: native.focused }),
  useRouter: () => ({
    canGoBack: native.canGoBack,
    back: native.back,
    replace: native.replace,
  }),
}));
vi.mock('react-native', () => ({
  Alert: { alert: native.alert },
  View: 'View',
  // Mount neighboring cells too, as a native list does while preloading.
  FlatList: (props: {
    data: Post[];
    renderItem: (info: { item: Post; index: number }) => ReactNode;
  }) =>
    createElement(
      'FlatList',
      props,
      props.data.map((item, index) =>
        createElement(
          Fragment,
          { key: item.id },
          props.renderItem({ item, index }),
        ),
      ),
    ),
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('../../features/app-data/AppDataProvider', () => ({
  useData: native.data,
}));
vi.mock('../../features/photos/hooks/usePhoto', () => ({
  usePhoto: (id: string) => {
    const { data } = native.data();
    const photo = data.posts.find((post: Post) => post.id === id);
    return {
      photo,
      stamp: data.stamps.find(
        (stamp: { id: string }) => stamp.id === photo?.stampId,
      ),
      trip: data.trips.find(
        (trip: { id: string }) => trip.id === photo?.tripId,
      ),
      photos: photo ? selectPhotos(data, { stampId: photo.stampId }) : [],
      isPending: false,
      error: null,
      invalidate: vi.fn(),
    };
  },
}));
vi.mock('../../shared/ui/QueryState', () => ({ QueryState: 'QueryState' }));
vi.mock('../../features/photos/lib/photoTransfer', () => ({
  sharePhoto: native.share,
  savePhotoToLibrary: native.save,
}));
vi.mock('../../shared/ui/Header', () => ({
  PageHeader: 'PageHeader',
}));
vi.mock('../../shared/ui/IconButton', () => ({ IconButton: 'IconButton' }));
vi.mock('../../shared/ui/StateView', () => ({ StateView: 'StateView' }));
vi.mock('../../shared/ui/PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('./components/ZoomPhoto', () => ({
  ZoomPhoto: (props: { post: Post; label: string; onDisplayed: () => void }) =>
    createElement('PhotoImage', {
      url: props.post.largeUrl,
      fit: 'contain',
      onDisplayed: props.onDisplayed,
    }),
}));
vi.mock('./components/PostVideo', () => ({ PostVideo: 'PostVideo' }));
vi.mock('../../features/photos/ui/PostImage', () => ({
  PostImage: 'PostImage',
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let store: {
  data: AppData;
  userId: string;
  client: { request: ReturnType<typeof vi.fn>; sessionGuard: () => () => void };
  actions: {
    markPhotoRead: ReturnType<typeof vi.fn>;
    setFavorite: ReturnType<typeof vi.fn>;
    deletePost: ReturnType<typeof vi.fn>;
  };
};
let photos: Post[];

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  const data = createDemoData();
  data.readPhotoIds = {};
  data.posts = data.posts.map((post) => ({
    ...post,
    author: { ...data.users[1] },
    mediaUrl: `file:///legacy-original-${post.id}.jpg`,
    largeUrl: `https://display.example/large-${post.id}.webp`,
    smallUrl: `https://display.example/small-${post.id}.webp`,
  }));
  photos = selectPhotos(data, { stampId: data.stamps[0].id });
  store = {
    data,
    userId: DEMO_USER_ID,
    client: {
      request: vi.fn().mockImplementation(async ({ url }: { url: string }) => ({
        url: `https://original.example${url}`,
        mimeType: 'image/jpeg',
        fileName: 'IMG.jpg',
        expiresAt: '2099-01-01',
      })),
      sessionGuard: () => () => {},
    },
    actions: {
      markPhotoRead: vi.fn().mockResolvedValue(undefined),
      setFavorite: vi
        .fn()
        .mockImplementation(async (id: string, isFavorite: boolean) => {
          store.data = {
            ...store.data,
            posts: store.data.posts.map((post) =>
              post.id === id ? { ...post, isFavorite } : post,
            ),
          };
        }),
      deletePost: vi
        .fn()
        .mockImplementation(async (_userId: string, id: string) => {
          store.data = {
            ...store.data,
            posts: store.data.posts.filter((post) => post.id !== id),
          };
        }),
    },
  };
  native.data.mockImplementation(() => store);
  native.focused.mockReturnValue(true);
  native.canGoBack.mockReturnValue(true);
  native.share.mockResolvedValue(undefined);
  native.save.mockResolvedValue(undefined);
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

const host = (type: string) => renderer!.root.findByType(type as never);
const buttons = () => renderer!.root.findAllByType('IconButton' as never);
const button = (label: string) =>
  buttons().find((node) => node.props.label === label)!;
const list = () => host('FlatList');
const image = (photo: Post) =>
  renderer!.root
    .findAllByType('PhotoImage' as never)
    .find((node) => node.props.url === photo.largeUrl)!;
const dialogButtons = () =>
  native.alert.mock.calls.at(-1)![2] as {
    text: string;
    style?: string;
    onPress?: () => void;
  }[];

async function mount(source: 'trip' | 'stamp' = 'stamp', photo = photos[1]) {
  const params: TripStackParamList['photo/[postId]'] = {
    postId: photo.id,
    source,
    tripId: photo.tripId,
    stampId: photo.stampId,
  };
  native.params.mockReturnValue(params);
  await act(async () => {
    renderer = create(createElement(PhotoDetailScreen));
  });
  const gallery = renderer!.root
    .findAllByType('View' as never)
    .find((node) => typeof node.props.onLayout === 'function')!;
  await act(async () =>
    gallery.props.onLayout({
      nativeEvent: { layout: { width: 390, height: 700 } },
    }),
  );
}

async function show(photo: Post) {
  await act(async () =>
    list().props.onViewableItemsChanged({
      viewableItems: [
        {
          item: photo,
          isViewable: true,
          key: photo.id,
          index: photos.indexOf(photo),
        },
      ],
    }),
  );
}

describe('photo detail', () => {
  it('opens the selected middle photo and only marks loaded, visible, focused photos as read', async () => {
    await mount();
    expect(list().props.data.map((photo: Post) => photo.id)).toEqual(
      photos.map((photo) => photo.id),
    );
    expect(list().props.initialScrollIndex).toBe(1);
    expect(list().props.horizontal).toBe(true);
    expect(list().props.pagingEnabled).toBe(true);
    expect(list().props.scrollEnabled).toBe(true);
    expect(list().props.getItemLayout(null, 2)).toEqual({
      length: 390,
      offset: 780,
      index: 2,
    });
    expect(image(photos[1]).props.fit).toBe('contain');

    await act(async () => image(photos[2]).props.onDisplayed());
    expect(store.actions.markPhotoRead).not.toHaveBeenCalled();
    await act(async () => image(photos[1]).props.onDisplayed());
    expect(store.actions.markPhotoRead).toHaveBeenCalledExactlyOnceWith(
      DEMO_USER_ID,
      photos[1].id,
    );
    await show(photos[2]);
    expect(store.actions.markPhotoRead).toHaveBeenLastCalledWith(
      DEMO_USER_ID,
      photos[2].id,
    );

    native.focused.mockReturnValue(false);
    await show(photos[0]);
    await act(async () => image(photos[0]).props.onDisplayed());
    expect(store.actions.markPhotoRead).toHaveBeenCalledTimes(2);
    native.focused.mockReturnValue(true);
    await act(async () => renderer!.update(createElement(PhotoDetailScreen)));
    expect(store.actions.markPhotoRead).toHaveBeenLastCalledWith(
      DEMO_USER_ID,
      photos[0].id,
    );
  });

  it('targets the current photo for ordered footer actions after swiping', async () => {
    await mount();
    expect(buttons().map((node) => node.props.label)).toEqual([
      '写真を共有',
      'お気に入りを解除',
      '写真をダウンロード',
      '写真を削除',
    ]);
    await show(photos[0]);
    await act(async () => button('写真を共有').props.onPress());
    expect(store.client.request).toHaveBeenCalledWith({
      url: `/posts/${photos[0].id}/original`,
    });
    expect(native.share).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://original.example/posts/${photos[0].id}/original`,
      }),
    );
    await act(async () => button('写真をダウンロード').props.onPress());
    expect(native.save).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://original.example/posts/${photos[0].id}/original`,
      }),
    );
    expect(native.alert).toHaveBeenCalledWith('写真を保存しました');
    await act(async () => button('お気に入りに追加').props.onPress());
    expect(store.actions.setFavorite).toHaveBeenCalledWith(photos[0].id, true);
  });

  it('keeps the trip favorite photo visible when unfavorited and disables gallery paging', async () => {
    await mount('trip');
    expect(list().props.data.map((photo: Post) => photo.id)).toEqual([
      photos[1].id,
    ]);
    expect(list().props.scrollEnabled).toBe(false);
    expect(host('PageHeader').props.title).toBe('写真');
    expect(host('PageHeader').props.backTitle).toBe(store.data.trips[0].name);
    await act(async () => button('お気に入りを解除').props.onPress());
    // Publish the mock store change, as the real Provider dispatch does.
    await act(async () => renderer!.update(createElement(PhotoDetailScreen)));
    expect(store.actions.setFavorite).toHaveBeenCalledWith(photos[1].id, false);
    expect(list().props.data.map((photo: Post) => photo.id)).toEqual([
      photos[1].id,
    ]);
    expect(button('お気に入りに追加')).toBeDefined();
    expect(native.back).not.toHaveBeenCalled();
  });

  it.each(['trip', 'stamp'] as const)(
    'uses the %s parent name and returns to that parent without history',
    async (source) => {
      native.canGoBack.mockReturnValue(false);
      await mount(source);
      expect(host('PageHeader').props.backTitle).toBe(
        source === 'trip'
          ? store.data.trips[0].name
          : store.data.stamps[0].name,
      );
      await act(async () => host('PageHeader').props.onBack());
      expect(native.replace).toHaveBeenCalledWith(
        source === 'trip'
          ? {
              pathname: '/trips/trip/[tripId]',
              params: { tripId: photos[1].tripId },
            }
          : {
              pathname: '/trips/stamp/[stampId]',
              params: { stampId: photos[1].stampId },
            },
      );
    },
  );

  it('cancels deletion without mutation and deletes the visible photo only after confirmation', async () => {
    await mount();
    await act(async () => button('写真を削除').props.onPress());
    const cancel = dialogButtons().find((item) => item.style === 'cancel')!;
    await act(async () => cancel.onPress?.());
    expect(store.actions.deletePost).not.toHaveBeenCalled();
    expect(native.back).not.toHaveBeenCalled();

    await show(photos[0]);
    await act(async () => button('写真を削除').props.onPress());
    const confirm = dialogButtons().find(
      (item) => item.style === 'destructive',
    )!;
    await act(async () => confirm.onPress!());
    expect(store.actions.deletePost).toHaveBeenCalledExactlyOnceWith(
      DEMO_USER_ID,
      photos[0].id,
    );
    expect(native.back).toHaveBeenCalledOnce();
  });

  it('prevents duplicate pending transfers and restores the gallery when sharing fails', async () => {
    let rejectShare!: (error: Error) => void;
    native.share.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectShare = reject;
        }),
    );
    await mount();
    const share = button('写真を共有').props.onPress;
    await act(async () => {
      share();
      share();
    });
    expect(native.share).toHaveBeenCalledOnce();
    expect(buttons().every((node) => node.props.disabled)).toBe(true);
    expect(list().props.scrollEnabled).toBe(false);
    await act(async () => rejectShare(new Error('共有に失敗')));
    expect(native.alert).toHaveBeenCalledWith(
      '操作できませんでした',
      '共有に失敗',
    );
    expect(buttons().every((node) => !node.props.disabled)).toBe(true);
    expect(list().props.scrollEnabled).toBe(true);
    expect(native.back).not.toHaveBeenCalled();
  });
});
