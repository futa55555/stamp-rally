import type {
  SelectedCategory,
  TemplateCategory,
  TemplateSelection,
} from './types';

export const stampSelectionKey = (category: string, title: string) =>
  JSON.stringify([category, title]);

export function reconcileSelection(
  categories: TemplateCategory[],
  previous: TemplateSelection,
): TemplateSelection {
  return Object.fromEntries(
    categories.flatMap((category) =>
      category.stamps.map(({ title }) => {
        const key = stampSelectionKey(category.name, title);
        return [key, previous[key] ?? true];
      }),
    ),
  );
}

export function categoryChecked(
  category: TemplateCategory,
  selection: TemplateSelection,
): boolean | 'mixed' {
  const count = category.stamps.filter(
    ({ title }) => selection[stampSelectionKey(category.name, title)],
  ).length;
  return count === 0
    ? false
    : count === category.stamps.length
      ? true
      : 'mixed';
}

export function selectedCategories(
  categories: TemplateCategory[],
  selection: TemplateSelection,
): SelectedCategory[] {
  return categories
    .map((category) => ({
      name: category.name,
      stamps: category.stamps
        .filter(
          ({ title }) => selection[stampSelectionKey(category.name, title)],
        )
        .map(({ title }) => ({ title })),
    }))
    .filter((category) => category.stamps.length > 0);
}
