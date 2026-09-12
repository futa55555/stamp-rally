import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TrashScreen } from './TrashScreen';
import { TrashPostScreen } from './TrashPostScreen';
import { groupTrashByTrip, type TrashedPost } from '../../features/trash/types';

const mocks = vi.hoisted(() => ({
  posts: [] as TrashedPost[],
  restore: vi.fn(),
  push: vi.fn(),
  back: vi.fn(),
  invalidate: vi.fn(),
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({
    push: mocks.push,
    back: mocks.back,
    canGoBack: () => true,
  }),
  useLocalSearchParams: () => ({ postId: 'post' }),
  useIsFocused: () => true,
}));
vi.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  SectionList: 'SectionList',
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
}));
vi.mock('../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: 'member',
    actions: { restorePost: mocks.restore },
  }),
}));
vi.mock('../../features/app-data/api/queries', () => ({
  useList: () => ({
    data: mocks.posts,
    isPending: false,
    error: null,
    invalidate: mocks.invalidate,
  }),
  useDetail: () => ({
    data: mocks.posts[0],
    isPending: false,
    error: null,
    invalidate: mocks.invalidate,
  }),
}));
vi.mock('../../features/photos/ui/PostImage', () => ({
  PostImage: 'PostImage',
}));
vi.mock('../photo-detail/components/PostVideo', () => ({
  PostVideo: 'PostVideo',
}));
vi.mock('../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
vi.mock('../../shared/ui/StateView', () => ({ StateView: 'StateView' }));
vi.mock('../../shared/ui/QueryState', () => ({ QueryState: 'QueryState' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const post = (id: string, tripId: string): TrashedPost => ({
  id,
  stampId: 'stamp',
  tripId,
  categoryIds: [],
  author: { id: 'author', name: '仲間' },
  mediaType: 'IMAGE',
  mediaUrl: 'https://media.test/photo',
  isFavorite: true,
  readAt: null,
  createdAt: '2026-09-12T00:00:00Z',
  updatedAt: '2026-09-12T00:00:00Z',
  deletedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
  stampName: 'たこ焼き',
  trip: {
    id: tripId,
    name: '大阪旅行',
    startDate: '2026-09-12',
    endDate: '2026-09-13',
  },
});
let view: ReturnType<typeof create> | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  const original = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (!String(args[0]).startsWith('react-test-renderer is deprecated'))
      original(...args);
  });
  mocks.posts = [post('post', 'trip')];
  mocks.restore.mockResolvedValue(mocks.posts[0]);
});
afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  vi.restoreAllMocks();
});

describe('trip-grouped trash', () => {
  it('joins pages by trip ID, preserving separate trips with the same name', () => {
    const first = post('one', 'trip-a'),
      second = post('two', 'trip-b'),
      nextPage = post('three', 'trip-a');
    const groups = groupTrashByTrip([first, second, nextPage, first]);
    expect(
      groups.map((group) => [group.trip.id, group.data.map((p) => p.id)]),
    ).toEqual([
      ['trip-a', ['one', 'three']],
      ['trip-b', ['two']],
    ]);
    expect(groupTrashByTrip([])).toEqual([]);
  });
  it('shows travel dates with the heading and opens the trash preview', async () => {
    await act(async () => {
      view = create(createElement(TrashScreen));
    });
    const list = view!.root.findByType('SectionList' as never);
    expect(list.props.sections[0].trip).toMatchObject({
      name: '大阪旅行',
      startDate: '2026-09-12',
      endDate: '2026-09-13',
    });
    const header = list.props.renderSectionHeader({
      section: list.props.sections[0],
    });
    expect(JSON.stringify(header.props.children)).toContain('2026-09-12');
    const row = list.props.renderItem({ item: mocks.posts[0] });
    await act(async () => row.props.onPress());
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: '/settings/trash/[postId]',
      params: { postId: 'post' },
    });
  });
  it('restores as the current member and returns only after success', async () => {
    await act(async () => {
      view = create(createElement(TrashPostScreen));
    });
    expect(view!.root.findByType('PostImage' as never).props.resourcePath).toBe(
      '/posts/trash/post',
    );
    await act(async () =>
      view!.root.findByType('Button' as never).props.onPress(),
    );
    expect(mocks.restore).toHaveBeenCalledWith('member', 'post');
    expect(mocks.back).toHaveBeenCalledOnce();
  });
  it('keeps failed restoration on screen for retry and uses trash URLs for videos', async () => {
    mocks.posts[0].mediaType = 'VIDEO';
    mocks.restore.mockRejectedValue(new Error('復元期限切れ'));
    await act(async () => {
      view = create(createElement(TrashPostScreen));
    });
    expect(view!.root.findByType('PostVideo' as never).props.resourcePath).toBe(
      '/posts/trash/post',
    );
    await act(async () =>
      view!.root.findByType('Button' as never).props.onPress(),
    );
    expect(mocks.back).not.toHaveBeenCalled();
    expect(view!.root.findByType('ErrorMessage' as never).props.message).toBe(
      '復元期限切れ',
    );
  });
});
