import { BadRequestException, Injectable } from '@nestjs/common';
import presets from './trip-template-presets.json' with { type: 'json' };
import { parseTripTemplatePresets } from './preset-catalog.js';
import type {
  GenreTemplateItem,
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
    genres: GenreTemplateItem[];
  }[] = [];
  const usedLocations = new Set<string>();
  for (const value of input.locations ?? []) {
    const preset = locations.get(value.trim());
    if (!preset || usedLocations.has(preset.name)) continue;
    usedLocations.add(preset.name);
    selected.push({
      source: { type: 'location', name: preset.name },
      genres: preset.template.genres,
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
      genres: preset.template.genres,
    });
  }

  const genres = new Map<
    string,
    Map<string, TripTemplatePreview['genres'][number]['stamps'][number]>
  >();
  for (const { source, genres: sourceGenres } of selected) {
    for (const genre of sourceGenres) {
      let stamps = genres.get(genre.name);
      if (!stamps) {
        stamps = new Map();
        genres.set(genre.name, stamps);
      }
      for (const { title } of genre.stamps) {
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
    genres: Array.from(genres, ([name, stamps]) => ({
      name,
      stamps: Array.from(stamps.values()),
    })).filter((genre) => genre.stamps.length > 0),
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
    selectedGenres: GenreTemplateItem[] = [],
  ): GenreTemplateItem[] {
    const candidates = new Map(
      this.preview(input).genres.map((genre) => [
        genre.name,
        new Set(genre.stamps.map((stamp) => stamp.title)),
      ]),
    );
    const selected = new Map<string, Set<string>>();
    for (const genre of selectedGenres) {
      const allowed = candidates.get(genre.name);
      if (!allowed) {
        throw new BadRequestException(`Unknown template genre: ${genre.name}`);
      }
      let titles = selected.get(genre.name);
      if (!titles) {
        titles = new Set();
        selected.set(genre.name, titles);
      }
      for (const { title } of genre.stamps) {
        if (!allowed.has(title)) {
          throw new BadRequestException(
            `Unknown template stamp: ${genre.name} / ${title}`,
          );
        }
        titles.add(title);
      }
    }
    return Array.from(selected, ([name, titles]) => ({
      name,
      stamps: Array.from(titles, (title) => ({ title })),
    })).filter((genre) => genre.stamps.length > 0);
  }
}
