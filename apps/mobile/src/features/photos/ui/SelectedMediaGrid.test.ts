import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickedMedia } from '../model/inputs';
import { SelectedMediaGrid } from './SelectedMediaGrid';

const native = vi.hoisted(() => ({ createPlayer: vi.fn() }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('expo-image', () => ({ Image: 'Image' }));
vi.mock('expo-video', () => ({ createVideoPlayer: native.createPlayer }));
vi.mock('../../../shared/ui/Icon', () => ({ Icon: 'Icon' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const photo: PickedMedia = {
  clientId: 'photo',
  uri: 'file:///photo.heic',
  fileName: 'photo.heic',
  mimeType: 'image/heic',
  byteSize: 100,
  mediaType: 'IMAGE',
};
const video: PickedMedia = {
  ...photo,
  clientId: 'video',
  uri: 'file:///video.mp4',
  fileName: 'video.mp4',
  mimeType: 'video/mp4',
  mediaType: 'VIDEO',
};
const thumbnail = () => ({ nativeRefType: 'image', release: vi.fn() });
let view: ReactTestRenderer | undefined;
let player: {
  replaceAsync: ReturnType<typeof vi.fn>;
  generateThumbnailsAsync: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
};
const images = () => view!.root.findAllByType('Image' as never);
const icons = () => view!.root.findAllByType('Icon' as never);

beforeEach(() => {
  vi.resetAllMocks();
  const originalError = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (String(args[0]).startsWith('react-test-renderer is deprecated')) return;
    originalError(...args);
  });
  player = {
    replaceAsync: vi.fn().mockResolvedValue(undefined),
    generateThumbnailsAsync: vi.fn().mockResolvedValue([thumbnail()]),
    release: vi.fn(),
  };
  native.createPlayer.mockReturnValue(player);
});

afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  vi.restoreAllMocks();
});

async function render(files: PickedMedia[]) {
  await act(async () => {
    const element = createElement(SelectedMediaGrid, { files });
    if (view) view.update(element);
    else view = create(element);
  });
}

describe('selected media previews', () => {
  it('displays local photos and a video thumbnail without starting playback', async () => {
    const image = thumbnail();
    player.generateThumbnailsAsync.mockResolvedValue([image]);
    await render([photo, video]);
    expect(images().map((preview) => preview.props.source)).toEqual([
      { uri: photo.uri },
      image,
    ]);
    expect(native.createPlayer).toHaveBeenCalledExactlyOnceWith(null);
    expect(player.replaceAsync).toHaveBeenCalledExactlyOnceWith(video.uri);
    expect(player.generateThumbnailsAsync).toHaveBeenCalledExactlyOnceWith(
      [0],
      {
        maxWidth: 256,
        maxHeight: 256,
      },
    );
    expect(player.release).toHaveBeenCalledOnce();
    expect(image.release).not.toHaveBeenCalled();
    expect(icons().some((icon) => icon.props.name === 'play')).toBe(true);
    expect(
      view!.root
        .findAllByType('View' as never)
        .filter((node) => node.props.accessibilityRole === 'image')
        .map((node) => node.props.accessibilityLabel),
    ).toEqual(['1件目の写真: photo.heic', '2件目の動画: video.mp4']);
    await render([]);
    expect(image.release).toHaveBeenCalledOnce();
    expect(player.release).toHaveBeenCalledOnce();
  });

  it('keeps an icon when a video preview cannot be generated', async () => {
    player.generateThumbnailsAsync.mockRejectedValue(
      new Error('Unsupported codec'),
    );
    await render([video]);
    expect(images()).toHaveLength(0);
    expect(icons().some((icon) => icon.props.name === 'video-outline')).toBe(
      true,
    );
    expect(player.release).toHaveBeenCalledOnce();
  });

  it('keeps an icon on image decode failure and displays a newly selected image', async () => {
    await render([photo]);
    await act(async () => images()[0].props.onError());
    expect(images()).toHaveLength(0);
    expect(icons().some((icon) => icon.props.name === 'image-outline')).toBe(
      true,
    );
    await render([
      { ...photo, clientId: 'replacement', uri: 'file:///other.jpg' },
    ]);
    expect(images()[0].props.source).toEqual({ uri: 'file:///other.jpg' });
    expect(native.createPlayer).not.toHaveBeenCalled();
  });

  it('discards a thumbnail that finishes after the selection was reset', async () => {
    let finish!: (images: ReturnType<typeof thumbnail>[]) => void;
    player.generateThumbnailsAsync.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await render([video]);
    await render([photo]);
    expect(player.release).toHaveBeenCalledOnce();
    const lateImage = thumbnail();
    await act(async () => finish([lateImage]));
    expect(images().map((preview) => preview.props.source)).toEqual([
      { uri: photo.uri },
    ]);
    expect(lateImage.release).toHaveBeenCalledOnce();
    expect(player.release).toHaveBeenCalledOnce();
  });

  it('releases the player on unmount while the video is still loading', async () => {
    let finish!: () => void;
    player.replaceAsync.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    await render([video]);
    await act(async () => view!.unmount());
    view = undefined;
    expect(player.release).toHaveBeenCalledOnce();
    await act(async () => finish());
    expect(player.generateThumbnailsAsync).not.toHaveBeenCalled();
    expect(player.release).toHaveBeenCalledOnce();
  });
});
