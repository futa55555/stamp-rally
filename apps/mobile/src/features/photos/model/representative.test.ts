import * as representative from './representative';
import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDemoData } from '../../app-data/mocks/fixtures';
import { useRepresentativePhotos } from '../hooks/useRepresentativePhotos';
import {
  candidateKey,
  chooseRepresentative,
  representativeCandidates,
} from './representative';
import type { Post } from './types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
afterEach(() => vi.restoreAllMocks());
const posts = createDemoData().posts.slice(0, 3);

describe('representative photos', () => {
  it('prefers favorites and includes video posters while excluding unfinished media', () => {
    expect(representativeCandidates(posts).map((p) => p.id)).toEqual(
      posts.slice(0, 2).map((p) => p.id),
    );
    const noFavorites = posts.map((p) => ({ ...p, isFavorite: false }));
    expect(representativeCandidates(noFavorites)).toHaveLength(3);
    expect(
      representativeCandidates([{ ...posts[0], mediaType: 'VIDEO' }]),
    ).toEqual([{ ...posts[0], mediaType: 'VIDEO' }]);
    expect(
      representativeCandidates([{ ...posts[0], status: 'PROCESSING' }]),
    ).toEqual([]);
    expect(chooseRepresentative([])).toBeNull();
    expect(chooseRepresentative(posts, () => 0)).toBe(posts[0].id);
    expect(chooseRepresentative(posts, () => 0.999)).toBe(posts[2].id);
    expect(candidateKey(posts)).toBe(candidateKey([...posts].reverse()));
  });
  it('draws only on mount or candidate membership changes, including favorite updates', async () => {
    // React 19 deprecates this renderer; keep unexpected errors visible.
    const originalError = console.error;
    vi.spyOn(console, 'error').mockImplementation((...args) => {
      if (String(args[0]).startsWith('react-test-renderer is deprecated'))
        return;
      originalError(...args);
    });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const draw = vi.spyOn(representative, 'chooseRepresentative');
    let selected: Post | undefined;
    function Probe({ photos }: { photos: Post[] }) {
      selected = useRepresentativePhotos([{ id: 'stamp', photos }]).stamp;
      return null;
    }
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(createElement(Probe, { photos: posts }));
    });
    expect(draw).toHaveBeenCalledTimes(1);
    const initial = selected!.id;
    await act(async () => {
      renderer.update(
        createElement(Probe, {
          photos: [...posts]
            .reverse()
            .map((p) => ({ ...p, updatedAt: '2030-01-01' })),
        }),
      );
    });
    expect(selected!.id).toBe(initial);
    expect(draw).toHaveBeenCalledTimes(1);
    // A non-favorite upload does not alter the favored candidate set.
    await act(async () => {
      renderer.update(
        createElement(Probe, {
          photos: [...posts, { ...posts[2], id: 'another' }],
        }),
      );
    });
    expect(draw).toHaveBeenCalledTimes(1);
    const unfavorited = posts.map((p) => ({ ...p, isFavorite: false }));
    random.mockReturnValue(0.999);
    await act(async () => {
      renderer.update(createElement(Probe, { photos: unfavorited }));
    });
    expect(draw).toHaveBeenCalledTimes(2);
    expect(selected!.id).toBe(posts[2].id);
    await act(async () => {
      renderer.update(
        createElement(Probe, {
          photos: [{ ...posts[0], isFavorite: false }, posts[1]],
        }),
      );
    });
    expect(draw).toHaveBeenCalledTimes(3);
    expect(selected!.id).toBe(posts[1].id);
    await act(async () => {
      renderer.unmount();
    });
    await act(async () => {
      renderer = create(createElement(Probe, { photos: posts }));
    });
    expect(draw).toHaveBeenCalledTimes(4);
    await act(async () => {
      renderer.unmount();
    });
  });
});
