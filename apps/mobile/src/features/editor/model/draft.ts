import type { AppData } from '../../app-data/model/types';
import {
  requireGenreAccess,
  requireStampAccess,
  requireTripAccess,
} from '../../trips/model/access';

export type PostScope = { tripId?: string; genreId?: string; stampId?: string };

export type PostDraft = PostScope & { mediaUrls: string[] };

export function initializePostDraft(
  data: AppData,
  userId: string,
  scope: PostScope,
): PostDraft {
  let { tripId, genreId, stampId } = scope;
  if (stampId) {
    const { genre } = requireStampAccess(data, userId, stampId);
    if (genreId && genreId !== genre.id)
      throw new Error('投稿先のジャンルが一致しません。');
    genreId = genre.id;
  }
  if (genreId) {
    const genre = requireGenreAccess(data, userId, genreId);
    if (tripId && tripId !== genre.tripId)
      throw new Error('投稿先の旅行が一致しません。');
    tripId = genre.tripId;
  }
  if (tripId) requireTripAccess(data, userId, tripId);
  return { tripId, genreId, stampId, mediaUrls: [] };
}

export function selectPostScope(
  draft: PostDraft,
  field: keyof PostScope,
  id: string,
): PostDraft {
  if (draft[field] === id) return draft;
  if (field === 'tripId')
    return { ...draft, tripId: id, genreId: undefined, stampId: undefined };
  if (field === 'genreId') return { ...draft, genreId: id, stampId: undefined };
  return { ...draft, stampId: id };
}
