import { createElement, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDemoData,
  DEMO_USER_ID,
} from '../../../features/app-data/mocks/fixtures';
import type { AppData } from '../../../features/app-data/model/types';
import type { PostDraft } from '../../../features/editor/model/draft';
import { initializePostDraft } from '../../../features/editor/model/draft';
import { SelectField } from '../../../shared/ui/SelectField';
import { PostForm } from './PostForm';

const native = vi.hoisted(() => ({
  data: vi.fn(),
  show: vi.fn(),
  push: vi.fn(),
  finish: vi.fn(),
  photoPicker: vi.fn(),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: native.push }),
}));
vi.mock('@expo/react-native-action-sheet', () => ({
  useActionSheet: () => ({ showActionSheetWithOptions: native.show }),
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  View: 'View',
  findNodeHandle: () => 17,
}));
vi.mock('../../../features/app-data/AppDataProvider', () => ({
  useData: native.data,
}));
vi.mock('../../../features/editor/EditorProvider', () => ({
  useEditor: () => {
    const [draft, setDraft] = useState<PostDraft | null>(null);
    return { draft, setDraft, finishing: false, finish: native.finish };
  },
}));
vi.mock('../../../features/editor/hooks/useEditorGuard', () => ({
  useEditorGuard: vi.fn(),
}));
vi.mock('../../../features/editor/ui/FormPage', () => ({
  FormPage: 'FormPage',
}));
vi.mock('../../../features/photos/hooks/usePhotoPicker', () => ({
  usePhotoPicker: native.photoPicker,
}));
vi.mock('../../../features/photos/ui/PhotoField', () => ({
  PhotoField: 'PhotoField',
}));
vi.mock('../../../shared/theme/ThemeProvider', () => ({
  useAppTheme: () => ({
    colors: {
      text: '#192B25',
      surface: '#FFFFFF',
      textSecondary: '#66756D',
      border: '#E0E6DF',
    },
  }),
}));
vi.mock('../../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../../shared/ui/Icon', () => ({ Icon: 'Icon' }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let renderer: ReactTestRenderer | undefined;
let store: { data: AppData; userId: string; actions: object };
let initial: PostDraft;

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  store = { data: createDemoData(), userId: DEMO_USER_ID, actions: {} };
  initial = {
    ...initializePostDraft(store.data, DEMO_USER_ID, {
      stampId: store.data.stamps[0].id,
    }),
    mediaUrls: ['file:///one.jpg', 'file:///two.jpg'],
  };
  native.data.mockImplementation(() => store);
  native.photoPicker.mockReturnValue({ pending: false, error: null });
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

const fields = () => renderer!.root.findAllByType(SelectField);
const field = (label: string) =>
  fields().find((node) => node.props.label === label)!;
const photos = () => renderer!.root.findByType('PhotoField' as never);
const sheet = () => {
  const [options, choose] = native.show.mock.calls.at(-1)!;
  return {
    options: options.options as string[],
    choose: choose as (index?: number) => void,
  };
};

async function render() {
  await act(async () => {
    if (renderer) renderer.update(createElement(PostForm, { initial }));
    else renderer = create(createElement(PostForm, { initial }));
  });
}

const open = (label: string) =>
  act(async () =>
    field(label)
      .findByType('Pressable' as never)
      .props.onPress(),
  );
const choose = (label: string) =>
  act(async () => {
    const index = sheet().options.indexOf(label);
    expect(index).toBeGreaterThanOrEqual(0);
    sheet().choose(index);
  });

describe('post destination selection', () => {
  it('limits options to joined trips and the selected parent hierarchy', async () => {
    const inaccessible = store.data.trips[1];
    store.data.memberships = store.data.memberships.filter(
      (member) =>
        member.userId !== DEMO_USER_ID || member.tripId !== inaccessible.id,
    );
    await render();
    expect(field('旅行').props.options).toEqual([
      { value: store.data.trips[0].id, label: store.data.trips[0].name },
      { value: store.data.trips[2].id, label: store.data.trips[2].name },
    ]);
    expect(
      field('ジャンル').props.options.map(
        (item: { value: string }) => item.value,
      ),
    ).toEqual(
      store.data.genres
        .filter((genre) => genre.tripId === initial.tripId)
        .map((genre) => genre.id),
    );
    expect(
      field('スタンプ').props.options.map(
        (item: { value: string }) => item.value,
      ),
    ).toEqual(
      store.data.stamps
        .filter((stamp) => stamp.genreId === initial.genreId)
        .map((stamp) => stamp.id),
    );
    await open('旅行');
    expect(sheet().options).not.toContain(inaccessible.name);
    expect(native.push).not.toHaveBeenCalled();
  });

  it('changes parents in place, clears only descendants and preserves selected photos', async () => {
    await render();
    await open('ジャンル');
    await choose(`${store.data.genres[0].name}（選択中）`);
    expect(field('スタンプ').props.value).toBe(initial.stampId);

    const genre = store.data.genres[1];
    await open('ジャンル');
    await choose(genre.name);
    expect(field('旅行').props.value).toBe(initial.tripId);
    expect(field('ジャンル').props.value).toBe(genre.id);
    expect(field('スタンプ').props.value).toBeUndefined();

    const stamp = store.data.stamps.find((item) => item.genreId === genre.id)!;
    await open('スタンプ');
    await choose(stamp.name);
    expect(field('スタンプ').props.value).toBe(stamp.id);

    await open('旅行');
    await choose(store.data.trips[1].name);
    expect(field('旅行').props.value).toBe(store.data.trips[1].id);
    expect(field('ジャンル').props.value).toBeUndefined();
    expect(field('スタンプ').props.value).toBeUndefined();
    expect(field('スタンプ').props.disabled).toBe(true);
    expect(photos().props.uris).toEqual(initial.mediaUrls);
    expect(native.push).not.toHaveBeenCalled();
  });

  it.each([
    ['ジャンル', 'ジャンルを新規作成', '/editor/genre', 'tripId'],
    ['スタンプ', 'スタンプを新規作成', '/editor/stamp', 'genreId'],
  ] as const)(
    'pushes the %s creation form with the parent scope and retains the post draft',
    async (label, createLabel, pathname, parent) => {
      await render();
      await open(label);
      await choose(createLabel);
      expect(native.push).toHaveBeenCalledExactlyOnceWith({
        pathname,
        params: { [parent]: initial[parent], fromPost: '1' },
      });
      expect(photos().props.uris).toEqual(initial.mediaUrls);
      expect(field('スタンプ').props.value).toBe(initial.stampId);
      expect(native.finish).not.toHaveBeenCalled();
    },
  );

  it('allows creation under empty parents and disables fields until their parent is selected', async () => {
    const emptyTrip = store.data.trips[2];
    initial = { tripId: emptyTrip.id, mediaUrls: initial.mediaUrls };
    await render();
    expect(field('ジャンル').props.options).toEqual([]);
    expect(field('ジャンル').props.disabled).toBe(false);
    expect(field('スタンプ').props.disabled).toBe(true);
    expect(field('スタンプ').props.create).toBeUndefined();
    await open('ジャンル');
    expect(sheet().options).toEqual(['ジャンルを新規作成', 'キャンセル']);
    await choose('ジャンルを新規作成');
    expect(native.push).toHaveBeenCalledWith({
      pathname: '/editor/genre',
      params: { tripId: emptyTrip.id, fromPost: '1' },
    });
  });

  it('blocks stale selections when access is lost and while photos are being prepared', async () => {
    await render();
    await open('ジャンル');
    const oldSheet = sheet();
    store.data.memberships = [];
    await render();
    expect(field('旅行').props.options).toEqual([]);
    expect(field('ジャンル').props.disabled).toBe(true);
    expect(field('スタンプ').props.disabled).toBe(true);
    await act(async () => oldSheet.choose(1));
    expect(field('ジャンル').props.value).toBe(initial.genreId);
    expect(photos().props.uris).toEqual(initial.mediaUrls);

    store.data = createDemoData();
    native.photoPicker.mockReturnValue({ pending: true, error: null });
    await render();
    expect(fields().every((node) => node.props.disabled)).toBe(true);
    await open('旅行');
    expect(native.show).toHaveBeenCalledOnce();
    expect(native.push).not.toHaveBeenCalled();
  });
});
