export type User = {
  id: string;
  name: string | null;
  status: 'ACTIVE' | 'ONBOARDING';
};
export type Trip = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  coverImageUrl: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  totalGenreCount: number;
  completedGenreCount: number;
  isCompleted: boolean;
};
export type Genre = {
  id: string;
  tripId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  totalStampCount: number;
  completedStampCount: number;
  isCompleted: boolean;
};
export type Stamp = {
  id: string;
  genreId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  isCompleted: boolean;
};
export type Post = {
  id: string;
  tripId: string;
  genreId: string;
  stampId: string;
  author: Pick<User, 'id' | 'name'>;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};
export type NotificationTarget =
  | { type: 'trip'; tripId: string }
  | { type: 'genre'; genreId: string }
  | { type: 'stamp'; stampId: string }
  | { type: 'photo'; postId: string };
export type AppNotification = {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  target: NotificationTarget;
};
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
export type LoginProvider = 'google' | 'apple';
