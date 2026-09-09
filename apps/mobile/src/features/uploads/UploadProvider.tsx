import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  onlineManager,
  useQueries,
  useQueryClient,
} from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';
import { useData } from '../app-data/AppDataProvider';
import { UploadManager } from './UploadManager';
import { removeOriginal, retainOriginal, transferFile } from './nativeTransfer';
import { isTerminal, type PendingBatch, type UploadBatch } from './model';

const Context = createContext<{
  manager: UploadManager | null;
  batches: PendingBatch[];
  error: string | null;
}>({ manager: null, batches: [], error: null });
export function UploadProvider({ children }: PropsWithChildren) {
  const { userId } = useData();
  return userId ? (
    <UserUploads key={userId} userId={userId}>
      {children}
    </UserUploads>
  ) : (
    children
  );
}
function UserUploads({
  userId,
  children,
}: PropsWithChildren<{ userId: string }>) {
  const { client } = useData();
  const cache = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const manager = useMemo(() => {
    const guard = client.sessionGuard();
    return new UploadManager(userId, {
      request: async (method, url, data, signal) => {
        guard();
        const result = await client.request({ method, url, data, signal });
        guard();
        return result as never;
      },
      read: () => AsyncStorage.getItem(`uploads.v1.${userId}`),
      write: (value) => AsyncStorage.setItem(`uploads.v1.${userId}`, value),
      retain: (id, uri) => retainOriginal(userId, id, uri),
      remove: (uri) => removeOriginal(userId, uri),
      transfer: transferFile,
      uuid: randomUUID,
      changed: () => {
        void cache.invalidateQueries({ queryKey: ['user', userId] });
      },
    });
  }, [client, cache, userId]);
  const batches = useSyncExternalStore(manager.subscribe, manager.snapshot);
  useEffect(() => {
    void manager
      .load()
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : '送信状況を復元できませんでした。',
        ),
      );
    const sync = () =>
      manager.setActive(
        AppState.currentState === 'active' && onlineManager.isOnline(),
      );
    sync();
    const subscription = AppState.addEventListener('change', sync);
    const unsubscribe = onlineManager.subscribe(sync);
    return () => {
      subscription.remove();
      unsubscribe();
      manager.stop();
    };
  }, [manager]);
  const pending = batches.filter(
    (batch) =>
      batch.id &&
      !batch.unavailable &&
      batch.files.some((file) => !isTerminal(file.status)),
  );
  const queries = useQueries({
    queries: pending.map((batch) => ({
      queryKey: ['user', userId, '/uploads/batches', batch.id],
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        client.request<UploadBatch>({
          url: `/uploads/batches/${batch.id}`,
          signal,
        }),
      refetchInterval: 4000,
    })),
  });
  // React Query owns polling/focus/network scheduling. Apply each server version
  // once so local progress emissions do not create a reconciliation loop.
  const versions = queries
    .map(
      (query, index) =>
        `${pending[index].id}:${query.dataUpdatedAt}:${query.errorUpdatedAt}`,
    )
    .join(',');
  useEffect(() => {
    queries.forEach((query, index) => {
      if (query.error) manager.markUnavailable(pending[index], query.error);
      else if (query.data) manager.reconcile(pending[index], query.data, true);
    });
  }, [versions, manager]);
  return (
    <Context.Provider value={{ manager, batches, error }}>
      {children}
    </Context.Provider>
  );
}
export const useUploads = () => useContext(Context);
