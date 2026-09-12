import type { AppData } from '../../app-data/model/types';

export function requireTripAccess(
  data: AppData,
  userId: string,
  tripId: string,
) {
  const trip = data.trips.find((item) => item.id === tripId);
  if (
    !trip ||
    !data.memberships.some((m) => m.tripId === tripId && m.userId === userId)
  )
    throw new Error('旅行が見つからないか、参加していません。');
  return trip;
}

export function requireCategoryAccess(
  data: AppData,
  userId: string,
  categoryId: string,
) {
  const category = data.categories.find((item) => item.id === categoryId);
  if (!category) throw new Error('カテゴリーが見つかりません。');
  requireTripAccess(data, userId, category.tripId);
  return category;
}

export function requireStampAccess(
  data: AppData,
  userId: string,
  stampId: string,
) {
  const stamp = data.stamps.find((item) => item.id === stampId);
  if (!stamp) throw new Error('スタンプが見つかりません。');
  const trip = requireTripAccess(data, userId, stamp.tripId);
  return { stamp, trip };
}
