import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Post } from '../../../features/photos/model/types';
import { PostVideo } from './PostVideo';

const native = vi.hoisted(() => ({
  playing: false,
  play: vi.fn(),
  replace: vi.fn(),
  request: vi.fn(),
  source: vi.fn(),
}));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('expo', () => ({
  useEvent: (_player: unknown, event: string) =>
    event === 'playingChange'
      ? { isPlaying: native.playing }
      : { status: 'readyToPlay' },
}));
vi.mock('expo-video', () => ({
  VideoView: 'VideoView',
  useVideoPlayer: (source: unknown) => {
    native.source(source);
    return {
      playing: native.playing,
      play: native.play,
      status: 'readyToPlay',
      replaceAsync: native.replace,
    };
  },
}));
vi.mock('../../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    client: { request: native.request, sessionGuard: () => () => {} },
  }),
}));
vi.mock('../../../features/photos/ui/PostImage', () => ({
  PostImage: 'Poster',
}));
vi.mock('../../../shared/ui/IconButton', () => ({ IconButton: 'IconButton' }));
vi.mock('../../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let renderer: ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
  vi.restoreAllMocks();
});

describe('video read receipt', () => {
  it('requires playback and a rendered frame, and only feeds the playback derivative to the native player', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    native.playing = false;
    const displayed = vi.fn();
    const post = {
      id: 'video',
      mediaType: 'VIDEO',
      mediaUrl: 'https://original',
      playbackUrl: 'https://playback.mp4',
      largeUrl: 'https://poster.webp',
    } as Post;
    const render = () =>
      createElement(PostVideo, { post, onDisplayed: displayed });
    await act(async () => {
      renderer = create(render());
    });
    expect(native.source).toHaveBeenLastCalledWith('https://playback.mp4');
    expect(renderer!.root.findByType('Poster' as never).props.variant).toBe(
      'large',
    );
    expect(displayed).not.toHaveBeenCalled();
    // A preloaded first frame is not playback and must not mark a post read.
    await act(async () =>
      renderer!.root
        .findByType('VideoView' as never)
        .props.onFirstFrameRender(),
    );
    expect(displayed).not.toHaveBeenCalled();
    await act(async () =>
      renderer!.root.findByType('IconButton' as never).props.onPress(),
    );
    expect(native.play).toHaveBeenCalledOnce();
    expect(displayed).not.toHaveBeenCalled();
    native.playing = true;
    await act(async () => renderer!.update(render()));
    expect(displayed).toHaveBeenCalledOnce();
    expect(
      native.source.mock.calls.some(
        ([source]) => source === 'https://original',
      ),
    ).toBe(false);
  });
});
