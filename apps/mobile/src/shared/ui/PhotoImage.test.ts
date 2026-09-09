import { createElement, type ComponentProps } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PhotoImage } from './PhotoImage';

const native = vi.hoisted(() => ({ source: vi.fn() }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('react-native', () => ({
  View: 'View',
  ActivityIndicator: 'ActivityIndicator',
}));
vi.mock('../../../assets/photoSources', () => ({ photoSource: native.source }));
vi.mock('../theme/ThemeProvider', () => ({
  useAppTheme: () => ({ colors: { onPhoto: '#fff', primary: '#000' } }),
}));
vi.mock('./AppText', () => ({ AppText: 'AppText' }));
vi.mock('./Icon', () => ({ Icon: 'Icon' }));
vi.mock('./IconButton', () => ({ IconButton: 'IconButton' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const first =
  'https://storage.example/media/post/version/large.webp?X-Amz-Date=20260910T000000Z&X-Amz-Signature=first';
const renewed =
  'https://storage.example/media/post/version/large.webp?X-Amz-Date=20260910T000002Z&X-Amz-Signature=second';
let renderer: ReactTestRenderer | undefined;
let props: ComponentProps<typeof PhotoImage>;

beforeEach(() => {
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  native.source.mockReset().mockImplementation((url: string) => ({ uri: url }));
  props = {
    url: first,
    blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
    onDisplayed: vi.fn(),
    refresh: vi.fn().mockResolvedValue(renewed),
  };
});

afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

async function render(update: Partial<typeof props> = {}) {
  props = { ...props, ...update };
  await act(async () => {
    if (renderer) renderer.update(createElement(PhotoImage, props));
    else renderer = create(createElement(PhotoImage, props));
  });
}
const image = () => renderer!.root.findByType('Image' as never);
const spinners = () =>
  renderer!.root.findAllByType('ActivityIndicator' as never);

it('keeps a displayed image mounted when refetch/favorite responses renew its URL', async () => {
  await render();
  const originalImage = image();
  const originalSource = originalImage.props.source;
  expect(originalSource.uri).toBe(first);
  expect(originalSource.cacheKey).toBe(
    'https://storage.example/media/post/version/large.webp',
  );
  await act(async () => image().props.onDisplay());
  expect(spinners()).toHaveLength(0);

  await render({ url: renewed });
  expect(image()).toBe(originalImage);
  expect(image().props.source).toEqual(originalSource);
  expect(spinners()).toHaveLength(0);
  expect(props.onDisplayed).toHaveBeenCalledOnce();
});

it('uses the same native cache entry when returning to an image with a renewed URL', async () => {
  await render();
  const cacheKey = image().props.source.cacheKey;
  await act(async () => renderer!.unmount());
  renderer = undefined;
  await render({ url: renewed });
  expect(image().props.source.uri).toBe(renewed);
  expect(image().props.source.cacheKey).toBe(cacheKey);
  expect(image().props.cachePolicy).toBe('memory-disk');
});

it.each(['small.webp', '../new-version/large.webp'])(
  'resets the displayed image when its asset changes to %s',
  async (replacement) => {
    await render();
    const originalImage = image();
    await act(async () => image().props.onDisplay());
    const changed = new URL(replacement, first).toString();
    await render({ url: changed });
    expect(image()).not.toBe(originalImage);
    expect(image().props.source.uri).toBe(changed);
    expect(spinners()).toHaveLength(1);
  },
);

it('retries a failed old URL with the latest props without another API request', async () => {
  await render();
  await render({ url: renewed });
  await act(async () => image().props.onError());
  expect(image().props.source.uri).toBe(renewed);
  expect(props.refresh).not.toHaveBeenCalled();
  await act(async () => image().props.onDisplay());
  expect(spinners()).toHaveLength(0);
});

it('recovers an expired URL once and allows manual retry after another failure', async () => {
  await render();
  await act(async () => image().props.onError());
  expect(props.refresh).toHaveBeenCalledOnce();
  expect(image().props.source.uri).toBe(renewed);
  // The list can still contain the old URL after the detail query is renewed.
  await act(async () => image().props.onError());
  expect(renderer!.root.findAllByType('Image' as never)).toHaveLength(0);
  await act(async () =>
    renderer!.root.findByType('IconButton' as never).props.onPress(),
  );
  expect(props.refresh).toHaveBeenCalledTimes(2);
  await act(async () => image().props.onDisplay());
  expect(spinners()).toHaveLength(0);
});

it('keeps bundled image sources as native asset references', async () => {
  native.source.mockReturnValue(42);
  await render();
  expect(image().props.source).toBe(42);
});
