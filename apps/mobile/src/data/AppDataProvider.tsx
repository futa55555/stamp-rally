import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
  type PropsWithChildren,
} from 'react';
import { createMockService, type DataService } from './service';
import { initialState, reducer } from './reducer';
import type { LoginProvider } from './types';

function useStore(service: DataService) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const load = useCallback(async () => {
    dispatch({ type: 'failed', message: null });
    try {
      dispatch({ type: 'loaded', data: await service.load() });
    } catch (error) {
      dispatch({
        type: 'failed',
        message:
          error instanceof Error ? error.message : '読み込みに失敗しました。',
      });
    }
  }, [service]);
  useEffect(() => {
    void load();
  }, [load]);
  const actions = useMemo(
    () => ({
      async signIn(provider: LoginProvider) {
        dispatch({ type: 'signedIn', userId: await service.signIn(provider) });
      },
      async signOut() {
        await service.signOut();
        dispatch({ type: 'signedOut' });
      },
      async setFavorite(postId: string, isFavorite: boolean) {
        dispatch({
          type: 'favoriteUpdated',
          post: await service.setFavorite(postId, isFavorite),
        });
      },
      async markPhotoRead(userId: string, postId: string) {
        await service.markPhotoRead(userId, postId);
        dispatch({ type: 'photoRead', userId, postId });
      },
      async markNotificationRead(id: string) {
        dispatch({
          type: 'notificationRead',
          notification: await service.markNotificationRead(id),
        });
      },
      async updateName(userId: string, name: string) {
        dispatch({
          type: 'nameUpdated',
          user: await service.updateName(userId, name),
        });
      },
    }),
    [service],
  );
  return { ...state, actions, reload: load };
}

const StoreContext = createContext<ReturnType<typeof useStore> | null>(null);

export function AppDataProvider({
  children,
  service,
}: PropsWithChildren<{ service?: DataService }>) {
  const [adapter] = useState(() => service ?? createMockService());
  const store = useStore(adapter);
  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}

export function useAppStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error('AppDataProvider is required');
  return store;
}

export function useData() {
  const store = useAppStore();
  if (!store.data)
    throw new Error('Data must be loaded before mounting a screen');
  return { ...store, data: store.data };
}
