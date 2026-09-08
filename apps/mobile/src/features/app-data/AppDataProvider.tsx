import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from 'react';
import type { LoginProvider } from '../auth/model/types';
import type { CreatePostsInput } from '../photos/model/inputs';
import type {
  CreateGenreInput,
  CreateStampInput,
  NamedInput,
  TripInput,
} from '../trips/model/inputs';
import type { DataService } from './api/DataService';
import { createMockService } from './mocks/service';
import { initialState, reducer } from './model/reducer';

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
      async createTrip(userId: string, input: TripInput) {
        const trip = await service.createTrip(userId, input);
        dispatch({ type: 'tripSaved', trip, memberId: userId });
        return trip;
      },
      async updateTrip(userId: string, id: string, input: TripInput) {
        const trip = await service.updateTrip(userId, id, input);
        dispatch({ type: 'tripSaved', trip });
        return trip;
      },
      async createGenre(userId: string, input: CreateGenreInput) {
        const genre = await service.createGenre(userId, input);
        dispatch({ type: 'genreSaved', genre });
        return genre;
      },
      async updateGenre(userId: string, id: string, input: NamedInput) {
        const genre = await service.updateGenre(userId, id, input);
        dispatch({ type: 'genreSaved', genre });
        return genre;
      },
      async createStamp(userId: string, input: CreateStampInput) {
        const stamp = await service.createStamp(userId, input);
        dispatch({ type: 'stampSaved', stamp });
        return stamp;
      },
      async updateStamp(userId: string, id: string, input: NamedInput) {
        const stamp = await service.updateStamp(userId, id, input);
        dispatch({ type: 'stampSaved', stamp });
        return stamp;
      },
      async createPosts(userId: string, input: CreatePostsInput) {
        const posts = await service.createPosts(userId, input);
        dispatch({ type: 'postsCreated', posts });
        return posts;
      },
      async deletePost(userId: string, postId: string) {
        await service.deletePost(userId, postId);
        dispatch({ type: 'postDeleted', postId });
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
