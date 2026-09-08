import type { User } from '../../auth/model/types';

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
