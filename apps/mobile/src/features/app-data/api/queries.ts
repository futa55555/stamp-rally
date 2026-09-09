import { useCallback, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { useQuery, type QueryKey } from '@tanstack/react-query';
import { useData } from '../AppDataProvider';

import { allPages, type Filters } from './pagination';
export { allPages, type Page, type Filters } from './pagination';
export const resourceKey = (
  userId: string,
  path: string,
  filters: Filters = {},
) => ['user', userId, path, filters] as const;

export function useRefetchOnFocus(refetch: () => unknown, enabled = true) {
  const latest = useRef(refetch);
  latest.current = refetch;
  useFocusEffect(
    useCallback(() => {
      if (enabled) void latest.current();
    }, [enabled]),
  );
}

export function useResource<T>(
  path: string,
  filters: Filters = {},
  list = false,
  enabled = true,
  initialData?: T,
) {
  const { userId, client, user } = useData();
  const active = enabled && !!userId && user?.status === 'ACTIVE';
  const query = useQuery<T | T[]>({
    queryKey: resourceKey(userId ?? '', path, filters),
    queryFn: ({ signal }) =>
      list
        ? allPages<T>(client, path, filters, signal)
        : client.request<T>({ url: path, params: filters, signal }),
    enabled: active,
    initialData,
  });
  useRefetchOnFocus(() => query.refetch({ cancelRefetch: false }), active);
  return {
    ...query,
    isPending: active && query.isPending,
    refetch: () => (active ? query.refetch() : Promise.resolve(query)),
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
  refetch: () => Promise<unknown>;
};
export function combineQueries(...queries: QueryState[]) {
  return {
    isPending: queries.some((query) => query.isPending),
    isFetching: queries.some((query) => query.isFetching),
    error: queries.find((query) => query.error)?.error ?? null,
    refetch: () => Promise.all(queries.map((query) => query.refetch())),
  };
}
export type { QueryKey };
