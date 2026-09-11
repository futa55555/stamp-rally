import type { SelectedGenre, TemplateGenre, TemplateSelection } from './types';

export const stampSelectionKey = (genre: string, title: string) =>
  JSON.stringify([genre, title]);

export function reconcileSelection(
  genres: TemplateGenre[],
  previous: TemplateSelection,
): TemplateSelection {
  return Object.fromEntries(
    genres.flatMap((genre) =>
      genre.stamps.map(({ title }) => {
        const key = stampSelectionKey(genre.name, title);
        return [key, previous[key] ?? true];
      }),
    ),
  );
}

export function genreChecked(
  genre: TemplateGenre,
  selection: TemplateSelection,
): boolean | 'mixed' {
  const count = genre.stamps.filter(
    ({ title }) => selection[stampSelectionKey(genre.name, title)],
  ).length;
  return count === 0 ? false : count === genre.stamps.length ? true : 'mixed';
}

export function selectedGenres(
  genres: TemplateGenre[],
  selection: TemplateSelection,
): SelectedGenre[] {
  return genres
    .map((genre) => ({
      name: genre.name,
      stamps: genre.stamps
        .filter(({ title }) => selection[stampSelectionKey(genre.name, title)])
        .map(({ title }) => ({ title })),
    }))
    .filter((genre) => genre.stamps.length > 0);
}
