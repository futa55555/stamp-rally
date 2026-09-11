import { expect, it } from 'vitest';
import {
  genreChecked,
  reconcileSelection,
  selectedGenres,
  stampSelectionKey,
} from './selection';
import type { TemplateGenre } from './types';

const genre = (name: string, titles: string[]): TemplateGenre => ({
  name,
  stamps: titles.map((title) => ({ title, sources: [] })),
});

it('preserves choices for remaining candidates, enables new ones and forgets removed ones', () => {
  const original = [genre('自然', ['海', '山']), genre('ごはん', ['海'])];
  const first = reconcileSelection(original, {});
  first[stampSelectionKey('自然', '海')] = false;
  const next = [genre('自然', ['海', '川']), genre('ごはん', ['海'])];
  const reconciled = reconcileSelection(next, first);
  expect(reconciled).toEqual({
    '["自然","海"]': false,
    '["自然","川"]': true,
    '["ごはん","海"]': true,
  });
  expect(genreChecked(next[0], reconciled)).toBe('mixed');
  expect(genreChecked(next[1], reconciled)).toBe(true);
  expect(selectedGenres(next, reconciled)).toEqual([
    { name: '自然', stamps: [{ title: '川' }] },
    { name: 'ごはん', stamps: [{ title: '海' }] },
  ]);
  expect(
    reconcileSelection(original, reconcileSelection([], reconciled))[
      '["自然","海"]'
    ],
  ).toBe(true);
});

it('keeps identities unambiguous and omits empty genres without sending sources', () => {
  expect(stampSelectionKey('a:b', 'c')).not.toBe(stampSelectionKey('a', 'b:c'));
  const empty = genre('自然', ['海']);
  expect(genreChecked(empty, { '["自然","海"]': false })).toBe(false);
  expect(selectedGenres([empty], { '["自然","海"]': false })).toEqual([]);
});
