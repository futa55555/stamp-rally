import { localDate } from './dates';
import type { AppData, Post, Trip } from './types';

export const newestFirst = <T extends { createdAt: string; id: string }>(
  a: T,
  b: T,
) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);

export const isActiveTrip = (trip: Trip, today = localDate(new Date())) =>
  trip.startDate <= today && today <= trip.endDate;

export function sortTrips(trips: Trip[], today = localDate(new Date())) {
  return [...trips].sort(
    (a, b) =>
      Number(isActiveTrip(b, today)) - Number(isActiveTrip(a, today)) ||
      newestFirst(a, b),
  );
}

export function isUnreadPhoto(data: AppData, userId: string, photo: Post) {
  return (
    photo.mediaType === 'IMAGE' &&
    photo.author.id !== userId &&
    !(data.readPhotoIds[userId] ?? []).includes(photo.id)
  );
}

export function hasUnreadPhotos(
  data: AppData,
  userId: string,
  scope: { genreId: string } | { stampId: string },
) {
  return data.posts.some(
    (p) =>
      ('stampId' in scope
        ? p.stampId === scope.stampId
        : p.genreId === scope.genreId) && isUnreadPhoto(data, userId, p),
  );
}

export function selectPhotos(
  data: AppData,
  scope: { tripId: string } | { stampId: string },
  favoritesOnly = false,
) {
  return data.posts
    .filter(
      (p) =>
        p.mediaType === 'IMAGE' &&
        ('tripId' in scope
          ? p.tripId === scope.tripId
          : p.stampId === scope.stampId) &&
        (!favoritesOnly || p.isFavorite),
    )
    .map((p) => ({
      ...p,
      author: {
        id: p.author.id,
        name:
          data.users.find((u) => u.id === p.author.id)?.name ?? p.author.name,
      },
    }))
    .sort(newestFirst);
}

export function validateName(
  name: string,
  userId: string,
  users: AppData['users'],
) {
  const normalized = name.trim();
  if (Array.from(normalized).length < 1 || Array.from(normalized).length > 20)
    throw new Error('名前は1〜20文字で入力してください。');
  if (users.some((u) => u.id !== userId && u.name === normalized))
    throw new Error('この名前はすでに使われています。');
  return normalized;
}
