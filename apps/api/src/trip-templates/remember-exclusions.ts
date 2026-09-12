import type { Prisma } from '../generated/prisma/client.js';
import { categoryExclusion, membershipExclusion } from './identity.js';

export async function rememberExclusions(
  tx: Prisma.TransactionClient,
  tripId: string,
  keys: string[],
) {
  if (!keys.length) return;
  const trip = await tx.trip.findUniqueOrThrow({ where: { id: tripId } });
  await tx.trip.update({
    where: { id: tripId },
    data: {
      templateExclusions: [
        ...new Set([...trip.templateExclusions, ...keys]),
      ].sort(),
    },
  });
}

export async function rememberCategoryRemoval(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const category = await tx.category.findUniqueOrThrow({ where: { id } });
  if (category.templateKey)
    await rememberExclusions(tx, category.tripId, [
      categoryExclusion(category.templateKey),
    ]);
}

export async function rememberMembershipRemoval(
  tx: Prisma.TransactionClient,
  stampId: string,
  categoryIds?: string[],
) {
  const stamp = await tx.stamp.findUniqueOrThrow({
    where: { id: stampId },
    include: {
      categories: {
        where: { categoryId: categoryIds ? { in: categoryIds } : undefined },
        include: { category: true },
      },
    },
  });
  if (!stamp.templateKey) return;
  await rememberExclusions(
    tx,
    stamp.tripId,
    stamp.categories.flatMap(({ category }) =>
      category.templateKey
        ? [membershipExclusion(category.templateKey, stamp.templateKey!)]
        : [],
    ),
  );
}
