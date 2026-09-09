import { pendingInvitation } from '../invitations/runtime';
import {
  QueryClientProvider,
  focusManager,
  onlineManager,
} from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import * as Network from 'expo-network';
import { queryClient, sessionClient } from './api/runtime';
import { identityCredentials } from '../auth/providers';
import type { LoginProvider } from '../auth/model/types';
import { createActions } from './api/actions';

function useStore() {
  const session = useSyncExternalStore(
    sessionClient.subscribe,
    sessionClient.snapshot,
  );
  const userId = session.user?.id ?? null;
  const actions = useMemo(
    () => ({
      ...createActions(sessionClient, queryClient, userId),
      signIn: (provider: LoginProvider) =>
        sessionClient.signIn(() => identityCredentials(provider)),
      signOut: async () => {
        const cleared = pendingInvitation.clear();
        await Promise.all([sessionClient.signOut(), cleared]);
      },
    }),
    [userId],
  );
  return {
    ...session,
    userId,
    actions,
    client: sessionClient,
    reload: sessionClient.restore,
  };
}
const StoreContext = createContext<ReturnType<typeof useStore> | null>(null);
function SessionProvider({ children }: PropsWithChildren) {
  const store = useStore();
  useEffect(() => {
    void sessionClient.restore();
  }, []);
  useEffect(() => {
    focusManager.setFocused(AppState.currentState === 'active');
    const app = AppState.addEventListener('change', (state) =>
      focusManager.setFocused(state === 'active'),
    );
    let received = false;
    const network = Network.addNetworkStateListener((state) => {
      received = true;
      onlineManager.setOnline(
        state.isConnected !== false && state.isInternetReachable !== false,
      );
    });
    void Network.getNetworkStateAsync()
      .then((state) => {
        if (!received)
          onlineManager.setOnline(
            state.isConnected !== false && state.isInternetReachable !== false,
          );
      })
      .catch(() => {});
    return () => {
      received = true;
      app.remove();
      network.remove();
    };
  }, []);
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
export function AppDataProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>{children}</SessionProvider>
    </QueryClientProvider>
  );
}
export function useData() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('AppDataProvider is required');
  return store;
}
export const useAppStore = useData;
