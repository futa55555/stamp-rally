import { useQueries } from '@tanstack/react-query';
import { useData } from '../app-data/AppDataProvider';
import { resourceKey } from '../app-data/api/queries';
import { useToday } from '../../shared/hooks/useToday';
import { combineQueries, useDetail, useList } from '../app-data/api/queries';
import type { Post } from '../photos/model/types';
import type { User } from '../auth/model/types';
import type { Genre, Stamp, Trip } from './model/types';
import { sortTrips } from './model/selectors';

export function useTrips() {
  const today = useToday();
  const query = useList<Trip>('/trips', {});
  return { ...query, today, trips: sortTrips(query.data ?? [], today) };
}
export function useTrip(tripId: string) {
  const { client, userId } = useData();
  const trip = useDetail<Trip>(`/trips/${tripId}`, !!tripId);
  const genres = useList<Genre>('/genres', { tripId }, !!trip.data);
  const favorites = useList<Post>(
    '/posts',
    { tripId, mediaType: 'IMAGE', favoritesOnly: true },
    !!trip.data,
  );
  const members = useList<{ user: User }>(
    `/trips/${tripId}/members`,
    {},
    !!trip.data,
  );
  const stampIds = [
    ...new Set((favorites.data ?? []).map((photo) => photo.stampId)),
  ];
  const stamps = useQueries({
    queries: stampIds.map((id) => ({
      queryKey: resourceKey(userId ?? '', `/stamps/${id}`),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        client.request<Stamp>({ url: `/stamps/${id}`, signal }),
      enabled: !!userId,
    })),
  });
  return {
    ...combineQueries(trip, genres, favorites, members, ...stamps),
    trip: trip.data,
    genres: (genres.data ?? []).map((genre) => ({
      ...genre,
      unread: genre.hasUnreadPhotos,
    })),
    favorites: (favorites.data ?? []).map((photo) => ({
      ...photo,
      genreName:
        genres.data?.find((genre) => genre.id === photo.genreId)?.name ?? '',
      stampName:
        stamps.find((query) => query.data?.id === photo.stampId)?.data?.name ??
        '',
    })),
    members: (members.data ?? []).map((member) => member.user),
  };
}
export function useGenre(genreId: string) {
  const genre = useDetail<Genre>(`/genres/${genreId}`, !!genreId);
  const trip = useDetail<Trip>(`/trips/${genre.data?.tripId}`, !!genre.data);
  const stamps = useList<Stamp>('/stamps', { genreId }, !!genre.data);
  // Finish every page before exposing candidates to the representative selector.
  const photos = useList<Post>(
    '/posts',
    { genreId, mediaType: 'IMAGE' },
    !!genre.data,
  );
  return {
    ...combineQueries(genre, trip, stamps, photos),
    genre: genre.data,
    trip: trip.data,
    stamps: (stamps.data ?? []).map((stamp) => ({
      ...stamp,
      unread: stamp.hasUnreadPhotos,
      photos: (photos.data ?? []).filter((photo) => photo.stampId === stamp.id),
    })),
  };
}
export function useStamp(stampId: string) {
  const stamp = useDetail<Stamp>(`/stamps/${stampId}`, !!stampId);
  const genre = useDetail<Genre>(
    `/genres/${stamp.data?.genreId}`,
    !!stamp.data,
  );
  const trip = useDetail<Trip>(`/trips/${genre.data?.tripId}`, !!genre.data);
  const photos = useList<Post>(
    '/posts',
    { stampId, mediaType: 'IMAGE' },
    !!stamp.data,
  );
  return {
    ...combineQueries(stamp, genre, trip, photos),
    stamp: stamp.data,
    genre: genre.data,
    trip: trip.data,
    photos: photos.data ?? [],
  };
}
