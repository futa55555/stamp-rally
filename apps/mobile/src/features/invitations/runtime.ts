import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { PendingInvitation } from './PendingInvitation';
import { invitationOrigin, invitationSharingEnabled } from './links';

const configuredScheme = Constants.expoConfig?.scheme;
export const invitationScheme =
  typeof configuredScheme === 'string'
    ? configuredScheme
    : (configuredScheme?.[0] ?? 'stamp-rally');
export const publicInvitationOrigin = invitationOrigin(
  process.env.EXPO_PUBLIC_INVITATION_ORIGIN,
);
export const publicInvitationLinksEnabled =
  process.env.EXPO_PUBLIC_INVITATION_LINKS_ENABLED === 'true' &&
  !!publicInvitationOrigin;
export const canShareInvitation = invitationSharingEnabled(
  invitationScheme,
  publicInvitationLinksEnabled,
);
const key = 'stamp-rally.pending-invitation';
export const pendingInvitation = new PendingInvitation({
  get: () => SecureStore.getItemAsync(key),
  set: (value) => SecureStore.setItemAsync(key, value),
  clear: () => SecureStore.deleteItemAsync(key),
});
