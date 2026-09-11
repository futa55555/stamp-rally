import type { Stamp } from '../model/types';

// This is a navigation preference, never a primary genre on the stamp.
export function stampGenreContext(
  stamp: Pick<Stamp, 'genreIds'> | undefined,
  preferred?: string,
) {
  return preferred && stamp?.genreIds.includes(preferred)
    ? preferred
    : stamp?.genreIds[0];
}
