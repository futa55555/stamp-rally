import type { AppData } from '../../app-data/model/types';

export function withProgress(data: AppData): AppData {
  const posted = new Set(data.posts.map((p) => p.stampId));
  const stamps = data.stamps.map((s) => ({
    ...s,
    isCompleted: posted.has(s.id),
  }));
  const genres = data.genres.map((g) => {
    const children = stamps.filter((s) => s.genreIds.includes(g.id));
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
    const children = genres.filter((g) => g.tripId === t.id);
    const completedGenreCount = children.filter((g) => g.isCompleted).length;
    return {
      ...t,
      totalGenreCount: children.length,
      completedGenreCount,
      isCompleted:
        children.length > 0 && completedGenreCount === children.length,
    };
  });
  const posts = data.posts.map((post) => ({
    ...post,
    genreIds:
      stamps.find((stamp) => stamp.id === post.stampId)?.genreIds ??
      post.genreIds,
  }));
  return { ...data, trips, genres, stamps, posts };
}
