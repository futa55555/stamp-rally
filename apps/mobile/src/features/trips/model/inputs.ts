import type { Genre, Trip } from './types';

export type TripInput = Pick<
  Trip,
  'name' | 'locations' | 'startDate' | 'endDate'
> & { clientRequestId?: string; coverAssetId?: string | null };

export type TripFormValues = TripInput & { coverImageUrl: string | null };

export type NamedInput = Pick<Genre, 'name' | 'description'>;

export type CreateGenreInput = NamedInput & { tripId: string };

export type CreateStampInput = NamedInput & { genreId: string };
