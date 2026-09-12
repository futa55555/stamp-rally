import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

// Match the category list's stable ordering in every stamp/post response.
export const categoryMemberships = {
  where: { category: { deletedAt: null } },
  select: { categoryId: true },
  orderBy: [{ category: { createdAt: 'asc' } }, { category: { id: 'asc' } }],
} as const satisfies Prisma.Stamp$categoriesArgs;

export async function requireStampCategories(
  tx: Prisma.TransactionClient,
  tripId: string,
  categoryIds: string[],
) {
  if (
    !categoryIds.length ||
    new Set(categoryIds).size !== categoryIds.length ||
    (await tx.category.count({
      where: {
        id: { in: categoryIds },
        tripId,
        deletedAt: null,
        trip: { deletedAt: null },
      },
    })) !== categoryIds.length
  ) {
    throw new BadRequestException(
      'Select one or more distinct categories from this trip',
    );
  }
}
