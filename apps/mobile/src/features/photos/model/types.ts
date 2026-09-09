import type { User } from '../../auth/model/types';

export type Post = {
  readAt: string | null;
  id: string;
  tripId: string;
  genreId: string;
  stampId: string;
  author: Pick<User, 'id' | 'name'>;
  mediaType: 'IMAGE' | 'VIDEO';
  mediaUrl: string;
  smallUrl?: string | null;
  largeUrl?: string | null;
  playbackUrl?: string | null;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  status?: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED';
  originalMimeType?: string | null;
  originalFileName?: string | null;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
};
