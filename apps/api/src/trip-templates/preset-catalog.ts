import type {
  ActivityPreset,
  CategoryTemplateItem,
  LocationPreset,
  TripTemplate,
  TripTemplatePresets,
} from './types.js';

function invalid(path: string, message: string): never {
  throw new Error(`Invalid trip-template-presets.json at ${path}: ${message}`);
}

function object(
  value: unknown,
  path: string,
  keys: string[],
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return invalid(path, 'expected an object');
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) invalid(`${path}.${key}`, 'unexpected property');
  }
  return record;
}

function array(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) return invalid(path, 'expected an array');
  return value;
}

function name(value: unknown, path: string): string {
  if (
    typeof value !== 'string' ||
    value !== value.trim() ||
    Array.from(value).length < 1 ||
    Array.from(value).length > 100
  ) {
    return invalid(path, 'expected a trimmed string of 1–100 characters');
  }
  return value;
}

function template(value: unknown, path: string): TripTemplate {
  const record = object(value, path, ['categories']);
  return {
    categories: array(record.categories, `${path}.categories`).map(
      (value, categoryIndex): CategoryTemplateItem => {
        const categoryPath = `${path}.categories[${categoryIndex}]`;
        const category = object(value, categoryPath, ['name', 'stamps']);
        return {
          name: name(category.name, `${categoryPath}.name`),
          stamps: array(category.stamps, `${categoryPath}.stamps`).map(
            (value, stampIndex) => {
              const stampPath = `${categoryPath}.stamps[${stampIndex}]`;
              const stamp = object(value, stampPath, ['title']);
              return { title: name(stamp.title, `${stampPath}.title`) };
            },
          ),
        };
      },
    ),
  };
}

/** Validate editable JSON once at startup, with an actionable path on failure. */
export function parseTripTemplatePresets(value: unknown): TripTemplatePresets {
  const root = object(value, '$', ['locations', 'activities']);
  const locations = array(root.locations, '$.locations').map(
    (value, index): LocationPreset => {
      const path = `$.locations[${index}]`;
      const preset = object(value, path, ['name', 'aliases', 'template']);
      return {
        name: name(preset.name, `${path}.name`),
        aliases: array(preset.aliases, `${path}.aliases`).map((alias, index) =>
          name(alias, `${path}.aliases[${index}]`),
        ),
        template: template(preset.template, `${path}.template`),
      };
    },
  );
  const activities = array(root.activities, '$.activities').map(
    (value, index): ActivityPreset => {
      const path = `$.activities[${index}]`;
      const preset = object(value, path, ['name', 'template']);
      return {
        name: name(preset.name, `${path}.name`),
        template: template(preset.template, `${path}.template`),
      };
    },
  );

  const locationNames = new Set<string>();
  const aliases = new Map<string, string>();
  locations.forEach((preset, index) => {
    const path = `$.locations[${index}]`;
    if (locationNames.has(preset.name)) {
      invalid(`${path}.name`, `duplicate location preset: ${preset.name}`);
    }
    locationNames.add(preset.name);
    for (const alias of [preset.name, ...preset.aliases]) {
      const owner = aliases.get(alias);
      if (owner !== undefined && owner !== preset.name) {
        invalid(
          path,
          `location name/alias "${alias}" also belongs to "${owner}"`,
        );
      }
      aliases.set(alias, preset.name);
    }
  });
  const activityNames = new Set<string>();
  activities.forEach((preset, index) => {
    if (activityNames.has(preset.name)) {
      invalid(
        `$.activities[${index}].name`,
        `duplicate activity: ${preset.name}`,
      );
    }
    activityNames.add(preset.name);
  });
  return { locations, activities };
}
