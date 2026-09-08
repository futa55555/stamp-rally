import type { Genre, Trip } from './types';

export type TripInput = Pick<
  Trip,
  'name' | 'locations' | 'startDate' | 'endDate' | 'coverImageUrl'
>;

export type NamedInput = Pick<Genre, 'name' | 'description'>;

export type CreateGenreInput = NamedInput & { tripId: string };

export type CreateStampInput = NamedInput & { genreId: string };
