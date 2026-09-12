import { stampCategoryContext } from './categoryContext';
import type { AppData } from '../../app-data/model/types';
import type { NotificationTarget } from '../../notifications/model/types';
import type { TripRoute } from './types';

export function resolveTarget(
  data: AppData,
  target: NotificationTarget,
  userId: string,
  viaCategoryId?: string,
): TripRoute[] | null {
  if (target.type === 'invitation' || target.type === 'invitation-link')
    return null;
  const post =
    target.type === 'photo' || target.type === 'video'
      ? data.posts.find((p) => p.id === target.postId)
      : undefined;
  const stampId = target.type === 'stamp' ? target.stampId : post?.stampId;
  const stamp = stampId ? data.stamps.find((s) => s.id === stampId) : undefined;
  const categoryId =
    target.type === 'category'
      ? target.categoryId
      : stampCategoryContext(stamp, viaCategoryId);
  const category = categoryId
    ? data.categories.find((g) => g.id === categoryId)
    : undefined;
  const tripId =
    target.type === 'trip'
      ? target.tripId
      : (stamp?.tripId ?? category?.tripId);
  if (
    !tripId ||
    !data.trips.some((t) => t.id === tripId) ||
    !data.memberships.some((m) => m.tripId === tripId && m.userId === userId)
  )
    return null;
  if (
    ((target.type === 'photo' || target.type === 'video') && !post) ||
    (stampId && !stamp) ||
    (categoryId && !category)
  )
    return null;
  const routes: TripRoute[] = [
    { name: 'index', params: undefined },
    { name: 'trip/[tripId]', params: { tripId } },
  ];
  if (category)
    routes.push({
      name: 'category/[categoryId]',
      params: { categoryId: category.id },
    });
  if (stamp)
    routes.push({
      name: 'stamp/[stampId]',
      params: { stampId: stamp.id, viaCategoryId: category?.id },
    });
  if (post)
    routes.push({
      name: 'photo/[postId]',
      params: { postId: post.id, viaCategoryId: category?.id },
    });
  return routes;
}

// Fetch ancestors explicitly when the destination has never been opened.
export async function resolveApiTarget(
  client: Pick<
    import('../../app-data/api/SessionClient').SessionClient,
    'request'
  >,
  target: NotificationTarget,
  viaCategoryId?: string,
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
  const categoryId =
    target.type === 'category'
      ? target.categoryId
      : stampCategoryContext(stamp, viaCategoryId);
  const category = categoryId
    ? await client.request<import('../model/types').Category>({
        url: `/categories/${categoryId}`,
      })
    : undefined;
  const tripId =
    target.type === 'trip'
      ? target.tripId
      : (stamp?.tripId ?? category?.tripId);
  const trip = await client.request<import('../model/types').Trip>({
    url: `/trips/${tripId}`,
  });
  const routes: TripRoute[] = [
    { name: 'index', params: undefined },
    { name: 'trip/[tripId]', params: { tripId: trip.id, title: trip.name } },
  ];
  if (category)
    routes.push({
      name: 'category/[categoryId]',
      params: { categoryId: category.id, title: category.name },
    });
  if (stamp)
    routes.push({
      name: 'stamp/[stampId]',
      params: {
        stampId: stamp.id,
        title: stamp.name,
        viaCategoryId: category?.id,
      },
    });
  if (post)
    routes.push({
      name: 'photo/[postId]',
      params: { postId: post.id, viaCategoryId: category?.id },
    });
  return routes;
}
