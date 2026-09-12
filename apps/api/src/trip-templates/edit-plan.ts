import { resolveSourceSelections } from './source-selections.js';
import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { TRASH_RETENTION_MS } from '../posts/trash-policy.js';
import { categoryExclusion, membershipExclusion } from './identity.js';
import type { TripTemplatesService } from './trip-templates.service.js';

export type TemplateChange = {
  categoryRef: string;
  stampRef?: string;
  selected: boolean;
};
export type TemplateEditInput = {
  locations?: string[];
  activityPresets?: string[];
  changes?: TemplateChange[];
};
export type EditStamp = {
  ref: string;
  id?: string;
  templateKey?: string;
  name: string;
  selected: boolean;
  manual: boolean;
  sources: string[];
  postCount: number;
  protectedCount: number;
  retained: boolean;
};
export type EditCategory = {
  ref: string;
  id?: string;
  templateKey?: string;
  name: string;
  selected: boolean;
  stamps: EditStamp[];
};
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;
export const hashPayload = (value: unknown) =>
  createHash('sha256')
    .update(JSON.stringify(canonical(value)))
    .digest('hex');
const templateRef = (key: string) => `template:${key}`;

/** Read and apply inside one serializable transaction. Preview uses the same calculation. */
export async function buildTemplatePlan(
  tx: Prisma.TransactionClient,
  tripId: string,
  templates: TripTemplatesService,
  input: TemplateEditInput,
) {
  const trip = await tx.trip.findUniqueOrThrow({
    where: { id: tripId, deletedAt: null },
  });
  const available = new Set(
    templates.catalog().activities.map((item) => item.name),
  );
  const activities = (input.activityPresets ?? trip.activityPresets)
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    activities.some(
      (name) => !available.has(name) && !trip.activityPresets.includes(name),
    )
  )
    throw new BadRequestException('Unknown activity preset');
  const resolved = resolveSourceSelections(
    templates.catalog(),
    {
      locations: input.locations ?? trip.locations,
      activityPresets: activities,
    },
    trip.templateSourceSelections,
  );
  const candidates = templates.preview({
    locations: resolved.input.locations,
    activityPresets: resolved.input.activityPresets.filter((name) =>
      available.has(name),
    ),
  });
  const [categories, stamps] = await Promise.all([
    tx.category.findMany({
      where: { tripId, deletedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    tx.stamp.findMany({
      where: { tripId, deletedAt: null },
      include: {
        categories: { where: { category: { deletedAt: null } } },
        posts: {
          where: { purgedAt: null },
          select: { id: true, status: true, deletedAt: true },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
  ]);
  const excluded = new Set(trip.templateExclusions);
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const nodes: EditCategory[] = categories.map((category) => ({
    ref: category.id,
    id: category.id,
    templateKey: category.templateKey ?? undefined,
    name: category.name,
    selected: !category.templateKey,
    stamps: stamps.flatMap((stamp) => {
      const membership = stamp.categories.find(
        (link) => link.categoryId === category.id,
      );
      if (!membership) return [];
      const protectedCount = stamp.posts.filter(
        (post) =>
          post.status !== 'CANCELLED' &&
          (!post.deletedAt || post.deletedAt.getTime() > cutoff),
      ).length;
      return [
        {
          ref: stamp.id,
          id: stamp.id,
          templateKey: stamp.templateKey ?? undefined,
          name: stamp.name,
          selected:
            membership.manual ||
            protectedCount > 0 ||
            membership.templateSources.some((source) =>
              resolved.unresolved.has(source),
            ),
          manual: membership.manual,
          sources: membership.templateSources.filter((source) =>
            resolved.unresolved.has(source),
          ),
          postCount: stamp.posts.length,
          protectedCount,
          retained: false,
        },
      ];
    }),
  }));
  for (const candidate of candidates.categories) {
    if (!candidate.key)
      throw new Error('Template category is missing a stable key');
    let category = nodes.find((item) => item.templateKey === candidate.key);
    if (!category) {
      category = {
        ref: templateRef(candidate.key),
        templateKey: candidate.key,
        name: candidate.name,
        selected: false,
        stamps: [],
      };
      nodes.push(category);
    }
    for (const item of candidate.stamps) {
      if (!item.key || item.sources.some((source) => !source.key))
        throw new Error('Template stamp or source is missing a stable key');
      const sources = item.sources.map(
        (source) => `${source.type}:${source.key}`,
      );
      let stamp = category.stamps.find(
        (stamp) => stamp.templateKey === item.key,
      );
      if (!stamp) {
        const existing = stamps.find((stamp) => stamp.templateKey === item.key);
        stamp = {
          ref: existing?.id ?? templateRef(item.key),
          id: existing?.id,
          templateKey: item.key,
          name: existing?.name ?? item.title,
          selected: false,
          manual: false,
          sources: [],
          postCount: existing?.posts.length ?? 0,
          protectedCount:
            existing?.posts.filter(
              (post) =>
                post.status !== 'CANCELLED' &&
                (!post.deletedAt || post.deletedAt.getTime() > cutoff),
            ).length ?? 0,
          retained: false,
        };
        category.stamps.push(stamp);
      }
      stamp.sources = [...new Set([...stamp.sources, ...sources])];
      if (
        !excluded.has(categoryExclusion(candidate.key)) &&
        !excluded.has(membershipExclusion(candidate.key, item.key))
      )
        stamp.selected = true;
    }
  }
  for (const category of nodes) {
    for (const stamp of category.stamps)
      stamp.retained =
        stamp.selected &&
        !stamp.manual &&
        !stamp.sources.length &&
        stamp.protectedCount > 0;
    category.selected ||= category.stamps.some((stamp) => stamp.selected);
  }
  const rememberUnavailable = (
    change: TemplateChange,
    existingCategoryKey?: string,
  ) => {
    const categoryKey =
      existingCategoryKey ??
      (change.categoryRef.startsWith('template:')
        ? change.categoryRef.slice(9)
        : undefined);
    if (!categoryKey) return false;
    const catalog = templates.catalog();
    const all = templates.preview({
      locations: catalog.locations.map((item) => item.name),
      activityPresets: catalog.activities.map((item) => item.name),
    });
    const category = all.categories.find((item) => item.key === categoryKey);
    if (!category) return false;
    const stampKey = change.stampRef?.startsWith('template:')
      ? change.stampRef.slice(9)
      : stamps.find((stamp) => stamp.id === change.stampRef)?.templateKey;
    if (
      change.stampRef &&
      (!stampKey || !category.stamps.some((stamp) => stamp.key === stampKey))
    )
      return false;
    const key = stampKey
      ? membershipExclusion(categoryKey, stampKey)
      : categoryExclusion(categoryKey);
    if (change.selected) excluded.delete(key);
    else excluded.add(key);
    return true;
  };
  const manuallyRemoved = new Set<string>();
  for (const change of input.changes ?? []) {
    const category = nodes.find((item) => item.ref === change.categoryRef);
    if (!category) {
      if (rememberUnavailable(change)) continue;
      throw new ConflictException(
        'カテゴリーが変更されました。編集画面を開き直してください。',
      );
    }
    if (change.stampRef) {
      const stamp = category.stamps.find(
        (item) => item.ref === change.stampRef,
      );
      if (!stamp) {
        if (rememberUnavailable(change, category.templateKey)) continue;
        throw new ConflictException(
          'スタンプが変更されました。編集画面を開き直してください。',
        );
      }
      stamp.selected = change.selected;
      if (change.selected && !stamp.sources.length) stamp.manual = true;
      if (!change.selected && stamp.id) manuallyRemoved.add(stamp.id);
      if (change.selected) category.selected = true;
      if (category.templateKey && stamp.templateKey) {
        const key = membershipExclusion(
          category.templateKey,
          stamp.templateKey,
        );
        if (change.selected) {
          if (excluded.has(categoryExclusion(category.templateKey))) {
            for (const sibling of category.stamps)
              if (!sibling.selected && sibling.templateKey)
                excluded.add(
                  membershipExclusion(
                    category.templateKey,
                    sibling.templateKey,
                  ),
                );
          }
          excluded.delete(key);
          excluded.delete(categoryExclusion(category.templateKey));
        } else excluded.add(key);
      }
    } else {
      category.selected = change.selected;
      if (category.templateKey) {
        if (change.selected)
          excluded.delete(categoryExclusion(category.templateKey));
        else excluded.add(categoryExclusion(category.templateKey));
      }
      for (const stamp of category.stamps) {
        stamp.selected = change.selected;
        if (change.selected && !stamp.sources.length) stamp.manual = true;
        if (!change.selected && stamp.id) manuallyRemoved.add(stamp.id);
        if (category.templateKey && stamp.templateKey) {
          const key = membershipExclusion(
            category.templateKey,
            stamp.templateKey,
          );
          if (change.selected) excluded.delete(key);
          else excluded.add(key);
        }
      }
    }
  }
  for (const category of nodes) {
    // Auto-remove empty template categories, while a manually created empty category survives.
    if (
      category.templateKey &&
      !category.stamps.some((stamp) => stamp.selected)
    )
      category.selected = false;
  }
  const keptIds = new Set(
    nodes
      .filter((category) => category.selected)
      .flatMap((category) =>
        category.stamps
          .filter((stamp) => stamp.selected && stamp.id)
          .map((stamp) => stamp.id!),
      ),
  );
  const removedStamps = stamps.filter(
    (stamp) => stamp.categories.length > 0 && !keptIds.has(stamp.id),
  );
  const destructive = removedStamps.filter((stamp) =>
    manuallyRemoved.has(stamp.id),
  );
  const impact = destructive
    .map((stamp) => ({
      stampId: stamp.id,
      postIds: stamp.posts.map((post) => post.id).sort(),
    }))
    .sort((a, b) => a.stampId.localeCompare(b.stampId));
  const view = {
    categories: nodes,
    impact: {
      stampCount: destructive.length,
      postCount: destructive.reduce(
        (count, stamp) => count + stamp.posts.length,
        0,
      ),
    },
    confirmationToken: hashPayload(impact),
  };
  const changed =
    hashPayload([...excluded].sort()) !==
      hashPayload([...trip.templateExclusions].sort()) ||
    removedStamps.length > 0 ||
    nodes.some((category) => {
      if (!category.id) return category.selected;
      if (!category.selected) return true;
      return category.stamps.some((stamp) => {
        const link = stamps
          .find((row) => row.id === stamp.id)
          ?.categories.find((link) => link.categoryId === category.id);
        return stamp.selected
          ? !link ||
              link.manual !== stamp.manual ||
              hashPayload([...link.templateSources].sort()) !==
                hashPayload([...stamp.sources].sort())
          : !!link;
      });
    });
  return {
    changed:
      changed ||
      hashPayload(resolved.selections) !==
        hashPayload(trip.templateSourceSelections),
    sourceSelections: resolved.selections,
    view,
    trip,
    stamps,
    excluded: [...excluded].sort(),
    removedStampIds: removedStamps.map((stamp) => stamp.id),
  };
}
export type TemplatePlan = Awaited<ReturnType<typeof buildTemplatePlan>>;
