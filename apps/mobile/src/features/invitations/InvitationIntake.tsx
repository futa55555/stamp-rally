import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import * as Linking from 'expo-linking';
import { usePathname, useRootNavigationState, useRouter } from 'expo-router';
import { useData } from '../app-data/AppDataProvider';
import { invitationTokenFromUrl, isPublicTopUrl } from './links';
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
  const [topLink, setTopLink] = useState(false);
  useEffect(() => {
    const revision = pendingInvitation.version();
    let alive = true;
    let received = false;
    const capture = (url: string) => {
      if (isPublicTopUrl(url, publicInvitationOrigin)) {
        void pendingInvitation.clear().catch(() => {});
        setTopLink(true);
        return;
      }
      const token = invitationTokenFromUrl(
        url,
        invitationScheme,
        publicInvitationOrigin,
      );
      if (token) {
        setTopLink(false);
        void pendingInvitation.capture(token).catch(() => {});
      }
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
    if (navigation?.key && topLink) {
      router.replace('/');
      setTopLink(false);
      return;
    }
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
    topLink,
  ]);
  useEffect(() => {
    if (previousUserId.current && !user && !pending.token && navigation?.key)
      router.replace('/login');
    previousUserId.current = user?.id;
  }, [user, pending.token, navigation?.key, router]);
  return null;
}
