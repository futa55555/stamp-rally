import { useQueryClient } from '@tanstack/react-query';
import { useData } from '../app-data/AppDataProvider';
import { resourceKey } from '../app-data/api/queries';
import type { Trip } from '../trips/model/types';
import { PhotoImage } from '../../shared/ui/PhotoImage';

export function TripCoverImage({
  trip,
  ...props
}: { trip: Pick<Trip, 'id' | 'coverImageUrl' | 'coverBlurhash'> } & Omit<
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
      url={trip.coverImageUrl}
      blurhash={trip.coverBlurhash}
      blurhashSizing="container"
      refresh={async () => {
        const guard = client.sessionGuard();
        const queryKey = resourceKey(userId ?? '', `/trips/${trip.id}`);
        await cache.invalidateQueries(
          { queryKey, exact: true },
          { cancelRefetch: false },
        );
        guard();
        const fresh = await cache.fetchQuery({
          queryKey,
          queryFn: ({ signal }) =>
            client.request<Trip>({ url: `/trips/${trip.id}`, signal }),
        });
        guard();
        return fresh.coverImageUrl;
      }}
    />
  );
}
