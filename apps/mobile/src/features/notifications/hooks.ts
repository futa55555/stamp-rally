import { useInfiniteQuery } from '@tanstack/react-query';
import { useData } from '../app-data/AppDataProvider';
import {
  resourceKey,
  useRefetchOnFocus,
  type Page,
} from '../app-data/api/queries';
import type { AppNotification } from './model/types';

export function useNotifications() {
  const { userId, user, client } = useData();
  const enabled = !!userId && user?.status === 'ACTIVE';
  const query = useInfiniteQuery({
    queryKey: resourceKey(userId ?? '', '/notifications', { limit: 20 }),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      client.request<Page<AppNotification> & { unreadCount: number }>({
        url: '/notifications',
        params: { limit: 20, cursor: pageParam },
        signal,
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
  });
  useRefetchOnFocus(() => query.refetch({ cancelRefetch: false }), enabled);
  return {
    ...query,
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
