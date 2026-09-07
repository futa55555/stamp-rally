import type { AppData, NotificationTarget } from '../data/types';
import type { TripRoute } from './types';

export function resolveTarget(
  data: AppData,
  target: NotificationTarget,
  userId: string,
): TripRoute[] | null {
  const post =
    target.type === 'photo'
      ? data.posts.find(
          (p) => p.id === target.postId && p.mediaType === 'IMAGE',
        )
      : undefined;
  const stampId = target.type === 'stamp' ? target.stampId : post?.stampId;
  const stamp = stampId ? data.stamps.find((s) => s.id === stampId) : undefined;
  const genreId = target.type === 'genre' ? target.genreId : stamp?.genreId;
  const genre = genreId ? data.genres.find((g) => g.id === genreId) : undefined;
  const tripId = target.type === 'trip' ? target.tripId : genre?.tripId;
  if (
    !tripId ||
    !data.trips.some((t) => t.id === tripId) ||
    !data.memberships.some((m) => m.tripId === tripId && m.userId === userId)
  )
    return null;
  if (
    (target.type === 'photo' && !post) ||
    (stampId && !stamp) ||
    (genreId && !genre)
  )
    return null;
  const routes: TripRoute[] = [
    { name: 'index', params: undefined },
    { name: 'trip/[tripId]', params: { tripId } },
  ];
  if (genre)
    routes.push({ name: 'genre/[genreId]', params: { genreId: genre.id } });
  if (stamp)
    routes.push({ name: 'stamp/[stampId]', params: { stampId: stamp.id } });
  if (post)
    routes.push({ name: 'photo/[postId]', params: { postId: post.id } });
  return routes;
}
