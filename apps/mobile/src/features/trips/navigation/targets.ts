import type { AppData } from '../../app-data/model/types';
import type { NotificationTarget } from '../../notifications/model/types';
import type { TripRoute } from './types';

export function resolveTarget(
  data: AppData,
  target: NotificationTarget,
  userId: string,
): TripRoute[] | null {
  if (target.type === 'invitation' || target.type === 'invitation-link')
    return null;
  const post =
    target.type === 'photo' || target.type === 'video'
      ? data.posts.find((p) => p.id === target.postId)
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
    ((target.type === 'photo' || target.type === 'video') && !post) ||
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

// Fetch ancestors explicitly when the destination has never been opened.
export async function resolveApiTarget(
  client: Pick<
    import('../../app-data/api/SessionClient').SessionClient,
    'request'
  >,
  target: NotificationTarget,
): Promise<TripRoute[]> {
  if (target.type === 'invitation' || target.type === 'invitation-link')
    throw new Error('参加申請の画面から確認してください。');
  const post =
    target.type === 'photo' || target.type === 'video'
      ? await client.request<import('../../photos/model/types').Post>({
          url: `/posts/${target.postId}`,
        })
      : undefined;
  const stampId = target.type === 'stamp' ? target.stampId : post?.stampId;
  const stamp = stampId
    ? await client.request<import('../model/types').Stamp>({
        url: `/stamps/${stampId}`,
      })
    : undefined;
  const genreId = target.type === 'genre' ? target.genreId : stamp?.genreId;
  const genre = genreId
    ? await client.request<import('../model/types').Genre>({
        url: `/genres/${genreId}`,
      })
    : undefined;
  const tripId = target.type === 'trip' ? target.tripId : genre?.tripId;
  const trip = await client.request<import('../model/types').Trip>({
    url: `/trips/${tripId}`,
  });
  const routes: TripRoute[] = [
    { name: 'index', params: undefined },
    { name: 'trip/[tripId]', params: { tripId: trip.id } },
  ];
  if (genre)
    routes.push({ name: 'genre/[genreId]', params: { genreId: genre.id } });
  if (stamp)
    routes.push({ name: 'stamp/[stampId]', params: { stampId: stamp.id } });
  if (post)
    routes.push({ name: 'photo/[postId]', params: { postId: post.id } });
  return routes;
}
