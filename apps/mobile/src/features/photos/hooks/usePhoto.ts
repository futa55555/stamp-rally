import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../app-data/AppDataProvider';
import { combineQueries, useDetail } from '../../app-data/api/queries';
import { useStamp } from '../../trips/hooks';
import type { Post } from '../model/types';

export function usePhoto(postId: string) {
  const { userId } = useData();
  const cache = useQueryClient();
  // Swiping uses photos already fetched for this user while refreshing the
  // detail, so the mounted gallery and its scroll position remain stable.
  const cached = cache
    .getQueriesData<Post[]>({ queryKey: ['user', userId, '/posts'] })
    .flatMap(([, data]) => data ?? [])
    .find((photo) => photo.id === postId);
  const post = useDetail<Post>(`/posts/${postId}`, !!postId, cached);
  const parent = useStamp(post.data?.stampId ?? '');
  return {
    ...combineQueries(post, parent),
    photo: post.data,
    stamp: parent.stamp,
    trip: parent.trip,
    photos: parent.photos,
  };
}
