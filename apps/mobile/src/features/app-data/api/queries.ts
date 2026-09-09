import { useIsFocused } from 'expo-router';
import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useData } from '../AppDataProvider';

import { allPages, type Filters } from './pagination';
export { allPages, type Page, type Filters } from './pagination';
export const resourceKey = (
  userId: string,
  path: string,
  filters: Filters = {},
) => ['user', userId, path, filters] as const;

export function useResource<T>(
  path: string,
  filters: Filters = {},
  list = false,
  enabled = true,
  initialData?: T,
) {
  const { userId, client, user } = useData();
  const cache = useQueryClient();
  const focused = useIsFocused();
  const active = enabled && !!userId && user?.status === 'ACTIVE';
  const queryKey = resourceKey(userId ?? '', path, filters);
  const query = useQuery<T | T[]>({
    queryKey,
    queryFn: ({ signal }) =>
      list
        ? allPages<T>(client, path, filters, signal)
        : client.request<T>({ url: path, params: filters, signal }),
    // Re-enabling a visible screen lets Query fetch only stale/missing data.
    enabled: active && focused,
    initialData,
  });
  return {
    ...query,
    isPending: active && query.isPending,
    invalidate: () =>
      active
        ? cache.invalidateQueries(
            { queryKey, exact: true },
            { cancelRefetch: false },
          )
        : Promise.resolve(),
  };
}

export function useDetail<T>(path: string, enabled: boolean, initialData?: T) {
  const query = useResource<T>(path, {}, false, enabled, initialData);
  return { ...query, data: query.data as T | undefined };
}
export function useList<T>(path: string, filters: Filters, enabled = true) {
  const query = useResource<T>(path, filters, true, enabled);
  return { ...query, data: query.data as T[] | undefined };
}

type QueryState = {
  isPending: boolean;
  isFetching: boolean;
  error: Error | null;
  invalidate: () => Promise<unknown>;
};
export function combineQueries(...queries: QueryState[]) {
  return {
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    error: queries.find((query) => query.error)?.error ?? null,
    invalidate: () => Promise.all(queries.map((query) => query.invalidate())),
  };
}
export type { QueryKey };
