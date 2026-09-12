import { expect, it } from 'vitest';
import {
  categoryChecked,
  reconcileSelection,
  selectedCategories,
  stampSelectionKey,
} from './selection';
import type { TemplateCategory } from './types';

const category = (name: string, titles: string[]): TemplateCategory => ({
  name,
  stamps: titles.map((title) => ({ title, sources: [] })),
});

it('preserves choices for remaining candidates, enables new ones and forgets removed ones', () => {
  const original = [category('自然', ['海', '山']), category('ごはん', ['海'])];
  const first = reconcileSelection(original, {});
  first[stampSelectionKey('自然', '海')] = false;
  const next = [category('自然', ['海', '川']), category('ごはん', ['海'])];
  const reconciled = reconcileSelection(next, first);
  expect(reconciled).toEqual({
    '["自然","海"]': false,
    '["自然","川"]': true,
    '["ごはん","海"]': true,
  });
  expect(categoryChecked(next[0], reconciled)).toBe('mixed');
  expect(categoryChecked(next[1], reconciled)).toBe(true);
  expect(selectedCategories(next, reconciled)).toEqual([
    { name: '自然', stamps: [{ title: '川' }] },
    { name: 'ごはん', stamps: [{ title: '海' }] },
  ]);
  expect(
    reconcileSelection(original, reconcileSelection([], reconciled))[
      '["自然","海"]'
    ],
  ).toBe(true);
});

it('keeps identities unambiguous and omits empty categories without sending sources', () => {
  expect(stampSelectionKey('a:b', 'c')).not.toBe(stampSelectionKey('a', 'b:c'));
  const empty = category('自然', ['海']);
  expect(categoryChecked(empty, { '["自然","海"]': false })).toBe(false);
  expect(selectedCategories([empty], { '["自然","海"]': false })).toEqual([]);
});

it('keeps deselected stable identities when category and stamp labels change', () => {
  const category = {
    key: 'category-key',
    name: '景色',
    stamps: [{ key: 'stamp-key', title: '海を見る', sources: [] }],
  };
  const previous = { [stampSelectionKey('category-key', 'stamp-key')]: false };
  const renamed = {
    ...category,
    name: '自然',
    stamps: [{ ...category.stamps[0], title: '海を眺める' }],
  };
  expect(reconcileSelection([renamed], previous)).toEqual(previous);
  expect(selectedCategories([renamed], previous)).toEqual([]);
  expect(
    selectedCategories([renamed], {
      [stampSelectionKey('category-key', 'stamp-key')]: true,
    }),
  ).toEqual([
    {
      key: 'category-key',
      name: '自然',
      stamps: [{ key: 'stamp-key', title: '海を眺める' }],
    },
  ]);
});
