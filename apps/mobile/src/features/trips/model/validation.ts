import { validateMediaUri } from '../../../shared/lib/media';
import type { NamedInput, TripInput } from './inputs';

export function validateDomainName(value: string) {
  const name = value.trim();
  if (!name || Array.from(name).length > 100)
    throw new Error('名前は1〜100文字で入力してください。');
  return name;
}

export function validateNamedInput(input: NamedInput): NamedInput {
  const name = validateDomainName(input.name);
  if (Array.from(input.description).length > 2000)
    throw new Error('説明は2,000文字以内で入力してください。');
  return { name, description: input.description };
}

export function validateTripInput(input: TripInput): TripInput {
  const name = validateDomainName(input.name);
  for (const value of [input.startDate, input.endDate]) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value.startsWith('0000-') ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new Error('日付を正しく選択してください。');
  }
  if (input.startDate > input.endDate)
    throw new Error('終了日は開始日以降にしてください。');
  return {
    ...input,
    name,
    locations: normalizeLocations(input.locations),
    coverImageUrl:
      input.coverImageUrl === null
        ? null
        : validateMediaUri(input.coverImageUrl),
  };
}

export function normalizeLocations(locations: string[] = []): string[] {
  return locations.map((location) => location.trim()).filter(Boolean);
}
