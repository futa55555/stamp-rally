import { useData } from '../../app-data/AppDataProvider';
import { useStamp } from '../../trips/hooks';

export function usePhoto(postId: string) {
  const { data } = useData();
  const post = data.posts.find(
    (p) => p.id === postId && p.mediaType === 'IMAGE',
  );
  const { stamp } = useStamp(post?.stampId ?? '');
  return {
    photo:
      stamp && post
        ? {
            ...post,
            author: {
              id: post.author.id,
              name:
                data.users.find((u) => u.id === post.author.id)?.name ??
                post.author.name,
            },
          }
        : undefined,
    stamp,
  };
}
