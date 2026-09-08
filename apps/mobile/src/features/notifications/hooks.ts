import { newestFirst } from '../../shared/lib/sort';
import { useData } from '../app-data/AppDataProvider';

export function useNotifications() {
  const { data, userId } = useData();
  return data.notifications
    .filter((n) => n.recipientId === userId)
    .sort(newestFirst);
}
