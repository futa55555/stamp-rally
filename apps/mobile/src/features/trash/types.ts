import type { Post } from '../photos/model/types';
import type { Trip } from '../trips/model/types';

export type TrashedPost = Post & {
  deletedAt: string;
  expiresAt: string;
  stampName: string;
  trip: Pick<Trip, 'id' | 'name' | 'startDate' | 'endDate'>;
};
export function groupTrashByTrip(posts: TrashedPost[]) {
  const groups = new Map<
    string,
    { trip: TrashedPost['trip']; data: TrashedPost[] }
  >();
  for (const post of posts) {
    let group = groups.get(post.trip.id);
    if (!group) {
      group = { trip: post.trip, data: [] };
      groups.set(post.trip.id, group);
    }
    if (!group.data.some((item) => item.id === post.id)) group.data.push(post);
  }
  return [...groups.values()];
}
export const restoreDeadline = (expiresAt: string) =>
  new Date(expiresAt).toLocaleString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
