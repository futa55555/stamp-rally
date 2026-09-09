import type { Post } from '../../photos/model/types';
import { withProgress } from '../../trips/model/progress';
import type { Genre, Stamp, Trip } from '../../trips/model/types';
import type { AppData } from './types';

export type DomainChange =
  | { type: 'tripSaved'; trip: Trip; memberId?: string }
  | { type: 'genreSaved'; genre: Genre }
  | { type: 'stampSaved'; stamp: Stamp }
  | { type: 'postsCreated'; posts: Post[] }
  | { type: 'postDeleted'; postId: string };

const upsert = <T extends { id: string }>(items: T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];

// The adapter and React store apply exactly the same domain changes.
export function applyDomainChange(
  data: AppData,
  change: DomainChange,
): AppData {
  switch (change.type) {
    case 'tripSaved':
      return withProgress({
        ...data,
        trips: upsert(data.trips, change.trip),
        memberships:
          change.memberId &&
          !data.memberships.some(
            (m) => m.tripId === change.trip.id && m.userId === change.memberId,
          )
            ? [
                ...data.memberships,
                { tripId: change.trip.id, userId: change.memberId },
              ]
            : data.memberships,
      });
    case 'genreSaved':
      return withProgress({
        ...data,
        genres: upsert(data.genres, change.genre),
      });
    case 'stampSaved':
      return withProgress({
        ...data,
        stamps: upsert(data.stamps, change.stamp),
      });
    case 'postsCreated':
      return withProgress({
        ...data,
        posts: change.posts.reduce(
          (items, post) => upsert(items, post),
          data.posts,
        ),
      });
    case 'postDeleted':
      return withProgress({
        ...data,
        posts: data.posts.filter((post) => post.id !== change.postId),
        readPhotoIds: Object.fromEntries(
          Object.entries(data.readPhotoIds).map(([userId, postIds]) => [
            userId,
            postIds.filter((postId) => postId !== change.postId),
          ]),
        ),
        notifications: data.notifications.filter(
          ({ target }) =>
            (target.type !== 'photo' && target.type !== 'video') ||
            target.postId !== change.postId,
        ),
      });
  }
}
