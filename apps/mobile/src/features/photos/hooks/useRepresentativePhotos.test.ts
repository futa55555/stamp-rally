import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';
import { useRepresentativePhotos } from './useRepresentativePhotos';
import { createDemoData } from '../../app-data/mocks/fixtures';
import type { Post } from '../model/types';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe('representative selections during refetch', () => {
  it('keeps the choice for identical candidates and draws again when favorites change', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const warn = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originals = createDemoData()
      .posts.slice(0, 2)
      .map((post) => ({ ...post, isFavorite: false }));
    let selected: string | undefined;
    function Screen({ photos }: { photos: Post[] }) {
      selected = useRepresentativePhotos([{ id: 'stamp', photos }]).stamp?.id;
      return null;
    }
    let screen: ReturnType<typeof create>;
    try {
      await act(async () => {
        screen = create(createElement(Screen, { photos: originals }));
      });
      const first = selected;
      const calls = random.mock.calls.length;
      await act(async () =>
        screen.update(
          createElement(Screen, {
            photos: originals.map((photo) => ({
              ...photo,
              readAt: '2026-09-09',
            })),
          }),
        ),
      );
      expect(selected).toBe(first);
      expect(random).toHaveBeenCalledTimes(calls);
      await act(async () =>
        screen.update(
          createElement(Screen, {
            photos: originals.map((photo, index) => ({
              ...photo,
              isFavorite: index === 1,
            })),
          }),
        ),
      );
      expect(selected).toBe(originals[1].id);
      expect(random.mock.calls.length).toBeGreaterThan(calls);
      await act(async () => screen.unmount());
    } finally {
      random.mockRestore();
      warn.mockRestore();
    }
  });
});
