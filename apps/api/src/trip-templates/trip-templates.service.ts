import { BadRequestException, Injectable } from '@nestjs/common';
import presets from './trip-template-presets.json' with { type: 'json' };
import { parseTripTemplatePresets } from './preset-catalog.js';
import type {
  CategoryTemplateItem,
  TripTemplateCatalog,
  TripTemplateInput,
  TripTemplatePresets,
  TripTemplatePreview,
  TripTemplateSource,
} from './types.js';

export function previewTripTemplates(
  catalog: TripTemplatePresets,
  input: TripTemplateInput,
): TripTemplatePreview {
  const locations = new Map(
    catalog.locations.flatMap((preset) =>
      [preset.name, ...preset.aliases].map((alias) => [alias, preset] as const),
    ),
  );
  const activities = new Map(
    catalog.activities.map((preset) => [preset.name, preset]),
  );
  const selected: {
    source: TripTemplateSource;
    categories: CategoryTemplateItem[];
  }[] = [];
  const usedLocations = new Set<string>();
  for (const value of input.locations ?? []) {
    const preset = locations.get(value.trim());
    if (!preset || usedLocations.has(preset.name)) continue;
    usedLocations.add(preset.name);
    selected.push({
      source: {
        type: 'location',
        name: preset.name,
        ...(preset.key ? { key: preset.key } : {}),
      },
      categories: preset.template.categories,
    });
  }
  const usedActivities = new Set<string>();
  for (const value of input.activityPresets ?? []) {
    const name = value.trim();
    if (!name) continue;
    const preset = activities.get(name);
    if (!preset) {
      throw new BadRequestException(`Unknown activity preset: ${name}`);
    }
    if (usedActivities.has(name)) continue;
    usedActivities.add(name);
    selected.push({
      source: {
        type: 'activity',
        name,
        ...(preset.key ? { key: preset.key } : {}),
      },
      categories: preset.template.categories,
    });
  }

  const categories = new Map<
    string,
    TripTemplatePreview['categories'][number]
  >();
  for (const { source, categories: sourceCategories } of selected) {
    for (const category of sourceCategories) {
      const identity = category.key ?? category.name;
      let result = categories.get(identity);
      if (!result) {
        result = {
          ...(category.key ? { key: category.key } : {}),
          name: category.name,
          stamps: [],
        };
        categories.set(identity, result);
      }
      for (const item of category.stamps) {
        const stamp = result.stamps.find(
          (s) => (s.key ?? s.title) === (item.key ?? item.title),
        );
        if (!stamp) result.stamps.push({ ...item, sources: [{ ...source }] });
        else if (
          !stamp.sources.some(
            (s) =>
              s.type === source.type &&
              (s.key ?? s.name) === (source.key ?? source.name),
          )
        )
          stamp.sources.push({ ...source });
      }
    }
  }
  return {
    categories: [...categories.values()].filter((c) => c.stamps.length > 0),
  };
}

@Injectable()
export class TripTemplatesService {
  private readonly presets = parseTripTemplatePresets(presets, true);

  catalog(): TripTemplateCatalog {
    return {
      locations: this.presets.locations.map(({ name, aliases }) => ({
        name,
        aliases: [...aliases],
      })),
      activities: this.presets.activities.map(({ name }) => ({ name })),
    };
  }

  preview(input: TripTemplateInput): TripTemplatePreview {
    return previewTripTemplates(this.presets, input);
  }

  identified(input: TripTemplateInput, selected: CategoryTemplateItem[] = []) {
    const allowed = this.select(input, selected);
    return this.preview(input).categories.flatMap((category) => {
      const choice = allowed.find((item) => item.name === category.name);
      return choice
        ? [
            {
              ...category,
              stamps: category.stamps.filter((stamp) =>
                choice.stamps.some((item) => item.title === stamp.title),
              ),
            },
          ]
        : [];
    });
  }

  select(
    input: TripTemplateInput,
    selectedCategories: CategoryTemplateItem[] = [],
  ): CategoryTemplateItem[] {
    const candidates = new Map(
      this.preview(input).categories.map((category) => [
        category.name,
        new Set(category.stamps.map((stamp) => stamp.title)),
      ]),
    );
    const selected = new Map<string, Set<string>>();
    for (const category of selectedCategories) {
      const allowed = candidates.get(category.name);
      if (!allowed) {
        throw new BadRequestException(
          `Unknown template category: ${category.name}`,
        );
      }
      let titles = selected.get(category.name);
      if (!titles) {
        titles = new Set();
        selected.set(category.name, titles);
      }
      for (const { title } of category.stamps) {
        if (!allowed.has(title)) {
          throw new BadRequestException(
            `Unknown template stamp: ${category.name} / ${title}`,
          );
        }
        titles.add(title);
      }
    }
    return Array.from(selected, ([name, titles]) => ({
      name,
      stamps: Array.from(titles, (title) => ({ title })),
    })).filter((category) => category.stamps.length > 0);
  }
}
