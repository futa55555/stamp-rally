import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { PendingInvitation } from './PendingInvitation';
import { invitationOrigin } from './links';

const configuredScheme = Constants.expoConfig?.scheme;
export const invitationScheme =
  typeof configuredScheme === 'string'
    ? configuredScheme
    : (configuredScheme?.[0] ?? 'stamp-rally');
export const publicInvitationOrigin = invitationOrigin(
  process.env.EXPO_PUBLIC_INVITATION_ORIGIN,
  Constants.expoConfig?.extra?.appVariant === 'local',
);
export const canShareInvitation = !!publicInvitationOrigin;
const key = 'stamp-rally.pending-invitation';
export const pendingInvitation = new PendingInvitation({
  get: () => SecureStore.getItemAsync(key),
  set: (value) => SecureStore.setItemAsync(key, value),
  clear: () => SecureStore.deleteItemAsync(key),
});
