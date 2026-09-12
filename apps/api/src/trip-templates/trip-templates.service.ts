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
      source: { type: 'location', name: preset.name },
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
      source: { type: 'activity', name },
      categories: preset.template.categories,
    });
  }

  const categories = new Map<
    string,
    Map<string, TripTemplatePreview['categories'][number]['stamps'][number]>
  >();
  for (const { source, categories: sourceCategories } of selected) {
    for (const category of sourceCategories) {
      let stamps = categories.get(category.name);
      if (!stamps) {
        stamps = new Map();
        categories.set(category.name, stamps);
      }
      for (const { title } of category.stamps) {
        const stamp = stamps.get(title);
        if (!stamp) {
          stamps.set(title, { title, sources: [{ ...source }] });
        } else if (
          !stamp.sources.some(
            (existing) =>
              existing.type === source.type && existing.name === source.name,
          )
        ) {
          stamp.sources.push({ ...source });
        }
      }
    }
  }
  return {
    categories: Array.from(categories, ([name, stamps]) => ({
      name,
      stamps: Array.from(stamps.values()),
    })).filter((category) => category.stamps.length > 0),
  };
}

@Injectable()
export class TripTemplatesService {
  private readonly presets = parseTripTemplatePresets(presets);

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
