import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../app-data/AppDataProvider';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { displayUrl } from '../model/display';
import type { Post } from '../model/types';

export function PostImage({
  post,
  variant = 'small',
  ...props
}: {
  post: Post;
  variant?: 'small' | 'large';
} & Omit<Parameters<typeof PhotoImage>[0], 'url' | 'blurhash' | 'refresh'>) {
  const { client, userId } = useData();
  const cache = useQueryClient();
  return (
    <PhotoImage
      {...props}
      url={displayUrl(post, variant)}
      blurhash={post.blurhash}
      refresh={async () => {
        const guard = client.sessionGuard();
        const fresh = await client.request<Post>({ url: `/posts/${post.id}` });
        guard();
        cache.setQueryData(['user', userId, `/posts/${post.id}`, {}], fresh);
        return displayUrl(fresh, variant);
      }}
    />
  );
}
