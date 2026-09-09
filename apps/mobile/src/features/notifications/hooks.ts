import { useIsFocused } from 'expo-router';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useData } from '../app-data/AppDataProvider';
import { resourceKey, type Page } from '../app-data/api/queries';
import type { AppNotification } from './model/types';

export function useNotifications() {
  const { userId, user, client } = useData();
  const cache = useQueryClient();
  const focused = useIsFocused();
  const enabled = !!userId && user?.status === 'ACTIVE';
  const queryKey = resourceKey(userId ?? '', '/notifications', { limit: 20 });
  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      client.request<Page<AppNotification> & { unreadCount: number }>({
        url: '/notifications',
        params: { limit: 20, cursor: pageParam },
        signal,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: enabled && focused,
  });
  return {
    ...query,
    invalidate: () =>
      enabled
        ? cache.invalidateQueries(
            { queryKey, exact: true },
            { cancelRefetch: false },
          )
        : Promise.resolve(),
    notifications: [
      ...new Map(
        query.data?.pages
          .flatMap((page) => page.items)
          .map((item) => [item.id, item]),
      ).values(),
    ],
    unreadCount: query.data?.pages.at(-1)?.unreadCount ?? 0,
  };
}
