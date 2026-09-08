import type { AppData } from '../../app-data/model/types';

export function requireTripAccess(
  data: AppData,
  userId: string,
  tripId: string,
) {
  const trip = data.trips.find((item) => item.id === tripId);
  if (
    !trip ||
    !data.memberships.some((m) => m.tripId === tripId && m.userId === userId)
  )
    throw new Error('旅行が見つからないか、参加していません。');
  return trip;
}

export function requireGenreAccess(
  data: AppData,
  userId: string,
  genreId: string,
) {
  const genre = data.genres.find((item) => item.id === genreId);
  if (!genre) throw new Error('ジャンルが見つかりません。');
  requireTripAccess(data, userId, genre.tripId);
  return genre;
}

export function requireStampAccess(
  data: AppData,
  userId: string,
  stampId: string,
) {
  const stamp = data.stamps.find((item) => item.id === stampId);
  if (!stamp) throw new Error('スタンプが見つかりません。');
  const genre = requireGenreAccess(data, userId, stamp.genreId);
  return { stamp, genre };
}
