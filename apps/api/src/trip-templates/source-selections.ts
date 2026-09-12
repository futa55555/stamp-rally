import type { Prisma } from '../generated/prisma/client.js';
import type { TripTemplateCatalog, TripTemplateInput } from './types.js';

/** Persist input-to-preset identity so changing catalog labels cannot remove a saved source. */
export function resolveSourceSelections(
  catalog: TripTemplateCatalog,
  input: TripTemplateInput,
  previous: Prisma.JsonValue = {},
) {
  const saved =
    previous && typeof previous === 'object' && !Array.isArray(previous)
      ? previous
      : {};
  const selections: Record<string, string> = {};
  const unresolved = new Set<string>();
  const resolve = (type: 'location' | 'activity', values: string[]) =>
    values.map((value) => {
      const name = value.trim();
      const identity = JSON.stringify([type, name]);
      const candidates =
        type === 'location' ? catalog.locations : catalog.activities;
      const oldKey = saved[identity];
      const preset = candidates.find((preset) =>
        typeof oldKey === 'string'
          ? preset.key === oldKey
          : preset.name === name ||
            ('aliases' in preset &&
              Array.isArray(preset.aliases) &&
              preset.aliases.includes(name)),
      );
      const key =
        preset?.key ?? (typeof oldKey === 'string' ? oldKey : undefined);
      if (key) {
        selections[identity] = key;
        if (!preset) unresolved.add(`${type}:${key}`);
      }
      return preset?.name ?? name;
    });
  const locations = resolve('location', input.locations ?? []);
  const activityPresets = resolve('activity', input.activityPresets ?? []);
  return { input: { locations, activityPresets }, selections, unresolved };
}
