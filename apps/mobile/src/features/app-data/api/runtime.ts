import * as SecureStore from 'expo-secure-store';
import { SessionClient } from './SessionClient';
import { createQueryClient } from './queryClient';

export const queryClient = createQueryClient();
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
