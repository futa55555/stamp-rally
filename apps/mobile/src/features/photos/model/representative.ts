import type { Post } from './types';

export function representativeCandidates(posts: Post[]): Post[] {
  const images = posts.filter(
    (post) => !post.status || post.status === 'READY',
  );
  const favorites = images.filter((post) => post.isFavorite);
  return (favorites.length ? favorites : images).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function candidateKey(candidates: Post[]): string {
  // Membership, not object identity/order or read state, controls a new draw.
  return JSON.stringify(candidates.map((post) => post.id).sort());
}

export function chooseRepresentative(
  candidates: Post[],
  random = Math.random,
): string | null {
  return candidates.length
    ? candidates[Math.floor(random() * candidates.length)].id
    : null;
}
