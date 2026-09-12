import type { Prisma } from '../generated/prisma/client.js';
import { purgePosts } from './purge-posts.js';

export async function deleteStamps(
  tx: Prisma.TransactionClient,
  ids: string[],
  now = new Date(),
) {
  if (!ids.length) return;
  await purgePosts(tx, { stampId: { in: ids } }, now);
  await tx.stamp.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: now },
  });
  await tx.stampCategory.deleteMany({ where: { stampId: { in: ids } } });
  await tx.notification.deleteMany({
    where: {
      OR: ids.map((id) => ({ target: { path: ['stampId'], equals: id } })),
    },
  });
}

export async function deleteCategories(
  tx: Prisma.TransactionClient,
  ids: string[],
  now = new Date(),
) {
  if (!ids.length) return;
  const orphaned = await tx.stamp.findMany({
    where: {
      deletedAt: null,
      categories: {
        some: { categoryId: { in: ids } },
        none: { categoryId: { notIn: ids }, category: { deletedAt: null } },
      },
    },
    select: { id: true },
  });
  await deleteStamps(
    tx,
    orphaned.map((stamp) => stamp.id),
    now,
  );
  await tx.stampCategory.deleteMany({ where: { categoryId: { in: ids } } });
  await tx.category.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { deletedAt: now },
  });
  await tx.notification.deleteMany({
    where: {
      OR: ids.map((id) => ({ target: { path: ['categoryId'], equals: id } })),
    },
  });
}
