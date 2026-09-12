import type { AppData } from '../../app-data/model/types';

export function withProgress(data: AppData): AppData {
  const posted = new Set(data.posts.map((p) => p.stampId));
  const stamps = data.stamps.map((s) => ({
    ...s,
    isCompleted: posted.has(s.id),
  }));
  const categories = data.categories.map((g) => {
    const children = stamps.filter((s) => s.categoryIds.includes(g.id));
    const completedStampCount = children.filter((s) => s.isCompleted).length;
    return {
      ...g,
      totalStampCount: children.length,
      completedStampCount,
      isCompleted:
        children.length > 0 && completedStampCount === children.length,
    };
  });
  const trips = data.trips.map((t) => {
    const children = categories.filter((g) => g.tripId === t.id);
    const completedCategoryCount = children.filter((g) => g.isCompleted).length;
    return {
      ...t,
      totalCategoryCount: children.length,
      completedCategoryCount,
      isCompleted:
        children.length > 0 && completedCategoryCount === children.length,
    };
  });
  const posts = data.posts.map((post) => ({
    ...post,
    categoryIds:
      stamps.find((stamp) => stamp.id === post.stampId)?.categoryIds ??
      post.categoryIds,
  }));
  return { ...data, trips, categories, stamps, posts };
}
