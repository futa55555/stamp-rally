import { newestFirst } from '../../../shared/lib/sort';
import type { AppData } from '../../app-data/model/types';
import type { Post } from './types';

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
        : p.genreIds.includes(scope.genreId)) && isUnreadPhoto(data, userId, p),
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
