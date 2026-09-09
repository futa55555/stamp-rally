import { QueryClient } from '@tanstack/react-query';
import * as SecureStore from 'expo-secure-store';
import { shouldRetry } from '../../../shared/api/errors';
import { SessionClient } from './SessionClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      staleTime: 30000,
      refetchOnMount: 'always',
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: 'always',
    },
    mutations: { retry: false },
  },
});
const key = 'stamp-rally.refresh-token';
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is required.');

export const sessionClient = new SessionClient(
  apiUrl,
  {
    get: () => SecureStore.getItemAsync(key),
    set: (value) => SecureStore.setItemAsync(key, value),
    clear: () => SecureStore.deleteItemAsync(key),
  },
  () => {
    void queryClient.cancelQueries();
    queryClient.clear();
  },
);
