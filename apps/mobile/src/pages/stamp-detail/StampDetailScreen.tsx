import { UploadList } from '../../features/uploads/UploadList';
import { QueryState } from '../../shared/ui/QueryState';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import { PhotoTile } from '../../features/photos/ui/PhotoTile';
import { useStamp } from '../../features/trips/hooks';
import { useTripHeader } from '../../features/trips/navigation/useTripHeader';
import { StateView } from '../../shared/ui/StateView';
import { CreatePostTile } from './components/CreatePostTile';
import { StampDetailHeader } from './sections/StampDetailHeader';

export function StampDetailScreen() {
  const router = useRouter();
  const { stampId, viaCategoryId } = useLocalSearchParams<{
    stampId: string;
    viaCategoryId?: string;
  }>();
  const query = useStamp(stampId, viaCategoryId);
  const refresh = usePullToRefresh(query.invalidate);
  const { stamp, category, categories, trip, photos } = query;
  useTripHeader({
    title: stamp?.name ?? 'スタンプ',
    trip,
    category,
    stamp,
    stampId,
  });
  const openPost = () =>
    router.push({
      pathname: '/editor/post',
      params: { stampId, viaCategoryId: category?.id },
    });
  if (query.isPending || query.error) return <QueryState query={query} />;
  if (!stamp)
    return (
      <StateView
        title="スタンプが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        {...refresh}
        data={photos.length ? [...photos, null] : photos}
        numColumns={2}
        keyExtractor={(photo) => (photo ? `post-${photo.id}` : 'create-post')}
        className="flex-1 bg-background"
        contentContainerClassName="pb-12 w-full"
        columnWrapperClassName="gap-0"
        ListHeaderComponent={
          <>
            <StampDetailHeader
              stamp={stamp}
              tripName={trip?.name}
              categoryNames={categories.map((category) => category.name)}
              viaCategoryId={category?.id}
            />
            <UploadList stampId={stampId} />
          </>
        }
        ListEmptyComponent={
          <StateView
            compact
            title="最初の一枚を楽しみに"
            description="最初の写真・動画を投稿して、スタンプを達成しましょう。"
            action={{ label: '写真・動画を投稿', onPress: openPost }}
            icon="camera-outline"
          />
        }
        renderItem={({ item }) =>
          item ? (
            <PhotoTile
              photo={item}
              onOpen={() =>
                router.push({
                  pathname: '/trips/photo/[postId]',
                  params: {
                    postId: item.id,
                    source: 'stamp',
                    stampId,
                    viaCategoryId: category?.id,
                  },
                })
              }
            />
          ) : (
            <CreatePostTile onPress={openPost} />
          )
        }
      />
    </>
  );
}
