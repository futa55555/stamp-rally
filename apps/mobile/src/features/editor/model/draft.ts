import type { AppData } from '../../app-data/model/types';
import {
  requireCategoryAccess,
  requireStampAccess,
  requireTripAccess,
} from '../../trips/model/access';

export type PostScope = {
  tripId?: string;
  categoryId?: string;
  stampId?: string;
};

export type PostDraft = PostScope & { mediaUrls: string[] };

export function initializePostDraft(
  data: AppData,
  userId: string,
  scope: PostScope,
): PostDraft {
  let { tripId, categoryId, stampId } = scope;
  if (stampId) {
    const { stamp } = requireStampAccess(data, userId, stampId);
    if (categoryId && !stamp.categoryIds.includes(categoryId))
      throw new Error('投稿先のカテゴリーが一致しません。');
    categoryId ??= stamp.categoryIds[0];
    if (tripId && tripId !== stamp.tripId)
      throw new Error('投稿先の旅行が一致しません。');
    tripId = stamp.tripId;
  }
  if (categoryId) {
    const category = requireCategoryAccess(data, userId, categoryId);
    if (tripId && tripId !== category.tripId)
      throw new Error('投稿先の旅行が一致しません。');
    tripId = category.tripId;
  }
  if (tripId) requireTripAccess(data, userId, tripId);
  return { tripId, categoryId, stampId, mediaUrls: [] };
}

export function selectPostScope(
  draft: PostDraft,
  field: keyof PostScope,
  id: string,
): PostDraft {
  if (draft[field] === id) return draft;
  if (field === 'tripId')
    return { ...draft, tripId: id, categoryId: undefined, stampId: undefined };
  if (field === 'categoryId')
    return { ...draft, categoryId: id, stampId: undefined };
  return { ...draft, stampId: id };
}
