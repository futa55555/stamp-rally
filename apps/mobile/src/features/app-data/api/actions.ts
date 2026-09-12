import type {
  Invitation,
  InvitationAction,
  InvitationLink,
} from '../../invitations/types';
import type { QueryClient } from '@tanstack/react-query';
import type { SessionClient } from './SessionClient';
import type { Trip, Category, Stamp } from '../../trips/model/types';
import type {
  TripInput,
  CreateTripInput,
  CreateCategoryInput,
  CreateStampInput,
  NamedInput,
  StampInput,
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
            /^\/(trips|categories|stamps|posts)(?:\/([^/]+))?/,
          );
          if (
            match &&
            !url.includes('/invitation-links') &&
            !url.includes('/invitations') &&
            result &&
            typeof result === 'object' &&
            'id' in result
          ) {
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
  const tripInput = (input: TripInput) => ({
    name: input.name,
    locations: input.locations,
    startDate: input.startDate,
    endDate: input.endDate,
    ...(input.coverAssetId !== undefined
      ? { coverAssetId: input.coverAssetId }
      : {}),
  });
  return {
    createInvitationLink: (tripId: string) =>
      mutate<InvitationLink & { token: string }>(
        'POST',
        '/trips/' + tripId + '/invitation-links',
      ),
    revokeInvitationLink: (id: string) =>
      mutate('POST', '/invitation-links/' + id + '/revoke'),
    requestInvitation: (token: string) =>
      mutate<Invitation>('POST', '/invitations', { token }),
    requestReceivedInvitation: (linkId: string) =>
      mutate<Invitation>('POST', '/invitation-links/' + linkId + '/request'),
    decideInvitation: (
      id: string,
      action: InvitationAction,
      generation: number,
    ) =>
      mutate<Invitation>('POST', '/invitations/' + id + '/' + action, {
        generation,
      }),
    async updateName(_userId: string, name: string) {
      const assertCurrent = client.sessionGuard();
      const user = await client.updateName(name);
      await cache.invalidateQueries({ queryKey: ['user', user.id] });
      assertCurrent();
      return user;
    },
    createTrip: (_userId: string, input: CreateTripInput) =>
      mutate<Trip>('POST', '/trips', {
        ...tripInput(input),
        ...(input.activityPresets !== undefined
          ? { activityPresets: input.activityPresets }
          : {}),
        ...(input.customActivities !== undefined
          ? { customActivities: input.customActivities }
          : {}),
        ...(input.selectedCategories !== undefined
          ? { selectedCategories: input.selectedCategories }
          : {}),
        ...(input.clientRequestId
          ? { clientRequestId: input.clientRequestId }
          : {}),
      }),
    updateTrip: (_userId: string, id: string, input: TripInput) =>
      mutate<Trip>('PATCH', `/trips/${id}`, tripInput(input)),
    createCategory: (_userId: string, input: CreateCategoryInput) =>
      mutate<Category>('POST', '/categories', input),
    updateCategory: (_userId: string, id: string, input: NamedInput) =>
      mutate<Category>('PATCH', `/categories/${id}`, input),
    createStamp: (_userId: string, input: CreateStampInput) =>
      mutate<Stamp>('POST', '/stamps', input),
    updateStamp: (_userId: string, id: string, input: StampInput) =>
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
