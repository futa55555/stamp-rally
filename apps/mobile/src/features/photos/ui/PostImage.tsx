import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../../app-data/AppDataProvider';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { displayUrl } from '../model/display';
import type { Post } from '../model/types';
import { resourceKey } from '../../app-data/api/queries';

export function PostImage({
  post,
  variant = 'small',
  resourcePath = `/posts/${post.id}`,
  ...props
}: {
  post: Post;
  resourcePath?: string;
  variant?: 'small' | 'large';
} & Omit<
  Parameters<typeof PhotoImage>[0],
  | 'url'
  | 'blurhash'
  | 'blurhashSizing'
  | 'imageWidth'
  | 'imageHeight'
  | 'refresh'
>) {
  const { client, userId } = useData();
  const cache = useQueryClient();
  return (
    <PhotoImage
      {...props}
      url={displayUrl(post, variant)}
      blurhash={post.blurhash}
      blurhashSizing="image"
      imageWidth={post.width}
      imageHeight={post.height}
      refresh={async () => {
        const guard = client.sessionGuard();
        const queryKey = resourceKey(userId ?? '', resourcePath);
        await cache.invalidateQueries(
          { queryKey, exact: true },
          { cancelRefetch: false },
        );
        guard();
        // A tile may only have list data. Register/read the detail query here;
        // fetchQuery also reuses it if invalidation already fetched fresh data.
        const fresh = await cache.fetchQuery({
          queryKey,
          queryFn: ({ signal }) =>
            client.request<Post>({ url: resourcePath, signal }),
        });
        guard();
        return displayUrl(fresh, variant);
      }}
    />
  );
}
