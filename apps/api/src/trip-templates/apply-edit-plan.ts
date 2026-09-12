import type { Prisma } from '../generated/prisma/client.js';
import {
  deleteCategories,
  deleteStamps,
} from '../deletions/delete-entities.js';
import type { TemplatePlan } from './edit-plan.js';

export async function applyTemplatePlan(
  tx: Prisma.TransactionClient,
  plan: TemplatePlan,
) {
  if (!plan.changed) return;
  const stampIds = new Map<string, string>();
  for (const stamp of plan.stamps) stampIds.set(stamp.id, stamp.id);
  // Attach new memberships first so shared stamps survive moves between categories.
  for (const category of plan.view.categories.filter(
    (category) => category.selected,
  )) {
    const categoryId =
      category.id ??
      (
        await tx.category.create({
          data: {
            tripId: plan.trip.id,
            name: category.name,
            templateKey: category.templateKey,
          },
        })
      ).id;
    for (const stamp of category.stamps.filter((stamp) => stamp.selected)) {
      let stampId = stampIds.get(stamp.ref);
      if (!stampId) {
        stampId = (
          await tx.stamp.create({
            data: {
              tripId: plan.trip.id,
              name: stamp.name,
              templateKey: stamp.templateKey,
            },
          })
        ).id;
        stampIds.set(stamp.ref, stampId);
      }
      await tx.stampCategory.upsert({
        where: { stampId_categoryId: { stampId, categoryId } },
        create: {
          stampId,
          categoryId,
          manual: stamp.manual,
          templateSources: stamp.sources,
        },
        update: { templateSources: stamp.sources, manual: stamp.manual },
      });
    }
  }
  for (const category of plan.view.categories.filter(
    (category) => category.id,
  )) {
    const removed = category.stamps
      .filter((stamp) => stamp.id && (!category.selected || !stamp.selected))
      .map((stamp) => stamp.id!);
    if (removed.length)
      await tx.stampCategory.deleteMany({
        where: { categoryId: category.id, stampId: { in: removed } },
      });
  }
  await deleteStamps(tx, plan.removedStampIds);
  await deleteCategories(
    tx,
    plan.view.categories
      .filter((category) => category.id && !category.selected)
      .map((category) => category.id!),
  );
  await tx.trip.update({
    where: { id: plan.trip.id },
    data: {
      templateExclusions: plan.excluded,
      templateSourceSelections: plan.sourceSelections,
    },
  });
}
