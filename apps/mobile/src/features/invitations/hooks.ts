import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useData } from '../app-data/AppDataProvider';
import { resourceKey, useDetail, useList } from '../app-data/api/queries';
import { isInvitationToken } from './links';
import type { Invitation, InvitationLink, InvitationPreview } from './types';

export const useInvitation = (id: string) =>
  useDetail<Invitation>('/invitations/' + id, !!id);
export const useInvitations = (view: 'mine' | 'review') =>
  useList<Invitation>('/invitations', { view });
export const useTripInvitations = (tripId: string) =>
  useList<Invitation>('/trips/' + tripId + '/invitations', {}, !!tripId);
export const useInvitationLinks = (tripId: string) =>
  useList<InvitationLink>(
    '/trips/' + tripId + '/invitation-links',
    {},
    !!tripId,
  );
export function useInvitationPreview(token: string, linkId?: string) {
  const { userId, user, client } = useData();
  const cache = useQueryClient();
  const focused = useIsFocused();
  const path = linkId
    ? '/invitation-links/' + linkId
    : '/invitation-links/resolve';
  const key = resourceKey(userId ?? '', path, linkId ? {} : { token });
  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal }) => {
      const assertCurrent = client.sessionGuard();
      const preview = await client.request<InvitationPreview>({
        method: linkId ? 'GET' : 'POST',
        url: path,
        ...(linkId ? {} : { data: { token } }),
        signal,
      });
      assertCurrent();
      if (!linkId)
        await cache.invalidateQueries({
          queryKey: ['user', userId, '/notifications'],
        });
      assertCurrent();
      return preview;
    },
    enabled:
      !!userId &&
      user?.status === 'ACTIVE' &&
      focused &&
      (!!linkId || isInvitationToken(token)),
  });
  return {
    ...query,
    invalidate: () => cache.invalidateQueries({ queryKey: key, exact: true }),
  };
}
