import type { Stamp } from '../model/types';

// This is a navigation preference, never a primary category on the stamp.
export function stampCategoryContext(
  stamp: Pick<Stamp, 'categoryIds'> | undefined,
  preferred?: string,
) {
  return preferred && stamp?.categoryIds.includes(preferred)
    ? preferred
    : stamp?.categoryIds[0];
}
