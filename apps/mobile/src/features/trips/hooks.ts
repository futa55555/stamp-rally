import { useToday } from '../../shared/hooks/useToday';
import { useData } from '../app-data/AppDataProvider';
import { hasUnreadPhotos, selectPhotos } from '../photos/model/selectors';
import { sortTrips } from './model/selectors';

export function useTrips() {
  const { data, userId } = useData();
  const today = useToday();
  const memberTripIds = new Set(
    data.memberships.filter((m) => m.userId === userId).map((m) => m.tripId),
  );
  return {
    today,
    trips: sortTrips(
      data.trips.filter((t) => memberTripIds.has(t.id)),
      today,
    ),
  };
}

export function useTrip(tripId: string) {
  const { data, userId } = useData();
  const accessible = data.memberships.some(
    (m) => m.tripId === tripId && m.userId === userId,
  );
  return {
    trip: accessible ? data.trips.find((t) => t.id === tripId) : undefined,
    genres: data.genres
      .filter((g) => g.tripId === tripId)
      .map((g) => ({
        ...g,
        unread: hasUnreadPhotos(data, userId!, { genreId: g.id }),
      })),
    favorites: selectPhotos(data, { tripId }, true),
    members: data.users.filter((u) =>
      data.memberships.some((m) => m.tripId === tripId && m.userId === u.id),
    ),
  };
}

export function useGenre(genreId: string) {
  const { data, userId } = useData();
  const genre = data.genres.find((g) => g.id === genreId);
  const accessible = data.memberships.some(
    (m) => m.tripId === genre?.tripId && m.userId === userId,
  );
  return {
    genre: accessible ? genre : undefined,
    trip: accessible
      ? data.trips.find((t) => t.id === genre?.tripId)
      : undefined,
    stamps: data.stamps
      .filter((s) => s.genreId === genreId)
      .map((s) => ({
        ...s,
        unread: hasUnreadPhotos(data, userId!, { stampId: s.id }),
        photoCount: selectPhotos(data, { stampId: s.id }).length,
        photos: selectPhotos(data, { stampId: s.id }),
      })),
  };
}

export function useStamp(stampId: string) {
  const { data } = useData();
  const stamp = data.stamps.find((s) => s.id === stampId);
  const { genre } = useGenre(stamp?.genreId ?? '');
  return {
    stamp: genre ? stamp : undefined,
    genre,
    trip: data.trips.find((t) => t.id === genre?.tripId),
    photos: selectPhotos(data, { stampId }),
  };
}
