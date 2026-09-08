import type { User } from '../../auth/model/types';
import type { AppNotification } from '../../notifications/model/types';
import type { Post } from '../../photos/model/types';
import type { Genre, Stamp, Trip } from '../../trips/model/types';

export type AppData = {
  users: User[];
  trips: Trip[];
  genres: Genre[];
  stamps: Stamp[];
  posts: Post[];
  memberships: { tripId: string; userId: string }[];
  notifications: AppNotification[];
  readPhotoIds: Record<string, string[]>;
};
