import type { QueryClient } from '@tanstack/react-query';
import type { SessionClient } from './SessionClient';
import type { Trip, Genre, Stamp } from '../../trips/model/types';
import type {
  TripInput,
  CreateGenreInput,
  CreateStampInput,
  NamedInput,
} from '../../trips/model/inputs';
import type { Post } from '../../photos/model/types';
import type { AppNotification } from '../../notifications/model/types';

export function createActions(
  client: SessionClient,
  cache: QueryClient,
  userId: string | null,
) {
  const mutate = async <T>(
    method: string,
    url: string,
    data?: unknown,
  ): Promise<T> => {
    if (!userId || client.snapshot().user?.id !== userId)
      throw new Error('ログインし直してください。');
    const assertCurrent = client.sessionGuard();
    return cache
      .getMutationCache()
      .build<T, Error, void, unknown>(cache, {
        // Fail offline writes promptly instead of replaying them in a later session.
        networkMode: 'always',
        retry: false,
        mutationFn: async () => {
          assertCurrent();
          const result = await client.request<T>({ method, url, data });
          assertCurrent();
          return result;
        },
        onSuccess: async (result) => {
          assertCurrent();
          const match = url.match(
            /^\/(trips|genres|stamps|posts)(?:\/([^/]+))?/,
          );
          if (match && result && typeof result === 'object' && 'id' in result) {
            cache.setQueryData(
              ['user', userId, `/${match[1]}/${result.id}`, {}],
              result,
            );
          }
          // Active screens update immediately; inactive screens refetch on return.
          await cache.invalidateQueries({ queryKey: ['user', userId] });
          assertCurrent();
        },
      })
      .execute();
  };
  const tripInput = (input: TripInput) => {
    if (input.coverImageUrl && !input.coverImageUrl.startsWith('https://'))
      throw new Error('カバー画像の追加・変更はまだ利用できません。');
    return input;
  };
  return {
    async updateName(_userId: string, name: string) {
      const assertCurrent = client.sessionGuard();
      const user = await client.updateName(name);
      await cache.invalidateQueries({ queryKey: ['user', user.id] });
      assertCurrent();
      return user;
    },
    createTrip: (_userId: string, input: TripInput) =>
      mutate<Trip>('POST', '/trips', tripInput(input)),
    updateTrip: (_userId: string, id: string, input: TripInput) =>
      mutate<Trip>('PATCH', `/trips/${id}`, tripInput(input)),
    createGenre: (_userId: string, input: CreateGenreInput) =>
      mutate<Genre>('POST', '/genres', input),
    updateGenre: (_userId: string, id: string, input: NamedInput) =>
      mutate<Genre>('PATCH', `/genres/${id}`, input),
    createStamp: (_userId: string, input: CreateStampInput) =>
      mutate<Stamp>('POST', '/stamps', input),
    updateStamp: (_userId: string, id: string, input: NamedInput) =>
      mutate<Stamp>('PATCH', `/stamps/${id}`, input),
    setFavorite: (id: string, isFavorite: boolean) =>
      mutate<Post>('PATCH', `/posts/${id}/favorite`, { isFavorite }),
    markPhotoRead: (_userId: string, id: string) =>
      mutate<Post>('PATCH', `/posts/${id}/read`),
    markNotificationRead: (id: string) =>
      mutate<AppNotification>('PATCH', `/notifications/${id}/read`),
    deletePost: (_userId: string, id: string) =>
      mutate<void>('DELETE', `/posts/${id}`),
  };
}
