import { useIsFocused } from 'expo-router';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useData } from '../app-data/AppDataProvider';
import { resourceKey } from '../app-data/api/queries';
import { useToday } from '../../shared/hooks/useToday';
import { combineQueries, useDetail, useList } from '../app-data/api/queries';
import type { Post } from '../photos/model/types';
import type { User } from '../auth/model/types';
import type { Category, Stamp, Trip } from './model/types';
import { sortTrips } from './model/selectors';
import { stampCategoryContext } from './navigation/categoryContext';

export function useTrips() {
  const today = useToday();
  const query = useList<Trip>('/trips', {});
  return { ...query, today, trips: sortTrips(query.data ?? [], today) };
}
export function useTrip(tripId: string) {
  const { client, userId } = useData();
  const cache = useQueryClient();
  const focused = useIsFocused();
  const trip = useDetail<Trip>(`/trips/${tripId}`, !!tripId);
  const categories = useList<Category>('/categories', { tripId }, !!trip.data);
  const favorites = useList<Post>(
    '/posts',
    { tripId, favoritesOnly: true },
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
      enabled: !!userId && focused,
    })),
  });
  return {
    ...combineQueries(
      trip,
      categories,
      favorites,
      members,
      ...stamps.map((query, index) => ({
        ...query,
        invalidate: () =>
          cache.invalidateQueries(
            {
              queryKey: resourceKey(userId ?? '', `/stamps/${stampIds[index]}`),
              exact: true,
            },
            { cancelRefetch: false },
          ),
      })),
    ),
    trip: trip.data,
    categories: (categories.data ?? []).map((category) => ({
      ...category,
      unread: category.hasUnreadMedia ?? category.hasUnreadPhotos,
    })),
    favorites: (favorites.data ?? []).map((photo) => ({
      ...photo,
      categoryName:
        categories.data
          ?.filter((category) => photo.categoryIds.includes(category.id))
          .map((category) => category.name)
          .join(', ') ?? '',
      stampName:
        stamps.find((query) => query.data?.id === photo.stampId)?.data?.name ??
        '',
    })),
    members: (members.data ?? []).map((member) => member.user),
  };
}
export function useCategory(categoryId: string) {
  const category = useDetail<Category>(
    `/categories/${categoryId}`,
    !!categoryId,
  );
  const trip = useDetail<Trip>(
    `/trips/${category.data?.tripId}`,
    !!category.data,
  );
  const stamps = useList<Stamp>('/stamps', { categoryId }, !!category.data);
  // Finish every page before exposing candidates to the representative selector.
  const photos = useList<Post>('/posts', { categoryId }, !!category.data);
  return {
    ...combineQueries(category, trip, stamps, photos),
    category: category.data,
    trip: trip.data,
    stamps: (stamps.data ?? []).map((stamp) => ({
      ...stamp,
      unread: stamp.hasUnreadMedia ?? stamp.hasUnreadPhotos,
      photos: (photos.data ?? []).filter((photo) => photo.stampId === stamp.id),
    })),
  };
}
export function useStamp(stampId: string, viaCategoryId?: string) {
  const stamp = useDetail<Stamp>(`/stamps/${stampId}`, !!stampId);
  const trip = useDetail<Trip>(`/trips/${stamp.data?.tripId}`, !!stamp.data);
  const categories = useList<Category>(
    '/categories',
    { tripId: stamp.data?.tripId },
    !!stamp.data,
  );
  const photos = useList<Post>('/posts', { stampId }, !!stamp.data);
  return {
    ...combineQueries(stamp, categories, trip, photos),
    stamp: stamp.data,
    categories: (categories.data ?? []).filter((category) =>
      stamp.data?.categoryIds.includes(category.id),
    ),
    category: categories.data?.find(
      (category) =>
        category.id === stampCategoryContext(stamp.data, viaCategoryId),
    ),
    trip: trip.data,
    photos: photos.data ?? [],
  };
}
