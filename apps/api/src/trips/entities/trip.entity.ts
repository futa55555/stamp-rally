import { isURL, isUUID } from 'class-validator';

export class InvalidTripError extends Error {}

export interface TripInput {
  clientRequestId?: string;
  locations?: string[];
  name: string;
  startDate: string;
  endDate: string;
  coverImageUrl?: string | null;
  coverAssetId?: string | null;
}

export function calendarDate(value: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new InvalidTripError('Dates must use YYYY-MM-DD');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    value.startsWith('0000-')
  ) {
    throw new InvalidTripError('Dates must be real calendar dates');
  }
  return date;
}

export class Trip {
  constructor(
    public readonly id: string,
    public name: string,
    public startDate: string,
    public endDate: string,
    public coverImageUrl: string | null,
    public readonly createdById: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly totalGenreCount = 0,
    public readonly completedGenreCount = 0,
    public locations: string[] = [],
    public coverAssetId: string | null = null,
  ) {}

  get isCompleted(): boolean {
    return (
      this.totalGenreCount > 0 &&
      this.completedGenreCount === this.totalGenreCount
    );
  }

  static validate(input: TripInput): TripInput {
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    if (!name || Array.from(name).length > 100) {
      throw new InvalidTripError(
        'Trip name must be between 1 and 100 characters',
      );
    }
    if (calendarDate(input.startDate) > calendarDate(input.endDate)) {
      throw new InvalidTripError('startDate must not be after endDate');
    }
    if (
      input.coverAssetId != null &&
      (typeof input.coverAssetId !== 'string' || !isUUID(input.coverAssetId))
    )
      throw new InvalidTripError('Invalid cover asset ID');
    let coverImageUrl: string | null = null;
    if (input.coverImageUrl !== undefined && input.coverImageUrl !== null) {
      if (typeof input.coverImageUrl !== 'string') {
        throw new InvalidTripError('Cover image must be a valid HTTPS URL');
      }
      coverImageUrl = input.coverImageUrl.trim();
      if (
        coverImageUrl.length > 2048 ||
        !isURL(coverImageUrl, {
          protocols: ['https'],
          require_protocol: true,
          require_valid_protocol: true,
          require_tld: false,
        })
      ) {
        throw new InvalidTripError(
          'Cover image must be a valid HTTPS URL of at most 2048 characters',
        );
      }
    }
    if (
      input.locations !== undefined &&
      (!Array.isArray(input.locations) ||
        input.locations.some((value) => typeof value !== 'string'))
    ) {
      throw new InvalidTripError('Locations must be an array of strings');
    }
    const locations = (input.locations ?? [])
      .map((value) => value.trim())
      .filter(Boolean);
    return { ...input, name, coverImageUrl, locations };
  }

  update(input: Partial<TripInput>): void {
    const next = Trip.validate({
      locations:
        input.locations === undefined ? this.locations : input.locations,
      name: input.name === undefined ? this.name : input.name,
      startDate:
        input.startDate === undefined ? this.startDate : input.startDate,
      endDate: input.endDate === undefined ? this.endDate : input.endDate,
      coverAssetId:
        input.coverAssetId === undefined
          ? this.coverAssetId
          : input.coverAssetId,
      coverImageUrl:
        input.coverAssetId !== undefined
          ? null
          : input.coverImageUrl === undefined
            ? this.coverImageUrl
            : input.coverImageUrl,
    });
    this.locations = next.locations ?? [];
    this.name = next.name;
    this.startDate = next.startDate;
    this.endDate = next.endDate;
    this.coverImageUrl = next.coverImageUrl ?? null;
    this.coverAssetId = next.coverAssetId ?? null;
  }

  toJSON() {
    return { ...this, isCompleted: this.isCompleted };
  }
}
