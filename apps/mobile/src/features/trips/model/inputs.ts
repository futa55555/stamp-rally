import type { Genre, Trip } from './types';
import type { SelectedGenre } from '../../trip-templates/types';

export type TripInput = Pick<
  Trip,
  'name' | 'locations' | 'startDate' | 'endDate'
> & { clientRequestId?: string; coverAssetId?: string | null };

export type CreateTripInput = TripInput & {
  activityPresets?: string[];
  customActivities?: string[];
  selectedGenres?: SelectedGenre[];
};

export type TripFormValues = TripInput & { coverImageUrl: string | null };

export type NamedInput = Pick<Genre, 'name' | 'description'>;

export type CreateGenreInput = NamedInput & { tripId: string };

export type StampInput = NamedInput & { genreIds?: string[] };
export type CreateStampInput = NamedInput & {
  tripId: string;
  genreIds: string[];
};
