import { useEffect, useRef, useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useData } from '../app-data/AppDataProvider';
import { invitationTokenFromUrl } from './links';
import {
  invitationScheme,
  pendingInvitation,
  publicInvitationOrigin,
} from './runtime';

export function InvitationIntake() {
  const { user } = useData();
  const router = useRouter();
  const path = usePathname();
  const navigation = useRootNavigationState();
  const pending = useSyncExternalStore(
    pendingInvitation.subscribe,
    pendingInvitation.snapshot,
  );
  const previousUserId = useRef(user?.id);
  useEffect(() => {
    const revision = pendingInvitation.version();
    let alive = true;
    let received = false;
    const capture = (url: string) => {
      const token = invitationTokenFromUrl(
        url,
        invitationScheme,
        publicInvitationOrigin,
      );
      if (token) void pendingInvitation.capture(token).catch(() => {});
    };
    const subscription = Linking.addEventListener('url', ({ url }) => {
      received = true;
      capture(url);
    });
    void pendingInvitation
      .restore()
      .then(async () => {
        const url = await Linking.getInitialURL();
        if (
          alive &&
          !received &&
          revision === pendingInvitation.version() &&
          url
        )
          capture(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (
      navigation?.key &&
      pending.ready &&
      pending.token &&
      user?.status === 'ACTIVE' &&
      path !== '/invite/' + pending.token
    ) {
      router.replace({
        pathname: '/invite/[token]',
        params: { token: pending.token },
      });
    }
  }, [
    navigation?.key,
    pending.ready,
    pending.token,
    user?.status,
    path,
    router,
  ]);
  useEffect(() => {
    if (previousUserId.current && !user && !pending.token && navigation?.key)
      router.replace('/login');
    previousUserId.current = user?.id;
  }, [user, pending.token, navigation?.key, router]);
  return null;
}
