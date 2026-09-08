import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import { PhotoTile } from '../../features/photos/ui/PhotoTile';
import { useStamp } from '../../features/trips/hooks';
import { StateView } from '../../shared/ui/StateView';
import { CreatePostTile } from './components/CreatePostTile';
import { StampDetailHeader } from './sections/StampDetailHeader';

export function StampDetailScreen() {
  const router = useRouter();
  const { stampId } = useLocalSearchParams<{ stampId: string }>();
  const { stamp, trip, photos } = useStamp(stampId);
  const openPost = () =>
    router.push({ pathname: '/editor/post', params: { stampId } });
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
        data={photos.length ? [...photos, null] : photos}
        numColumns={2}
        keyExtractor={(photo) => (photo ? `post-${photo.id}` : 'create-post')}
        className="flex-1 bg-background"
        contentContainerClassName="pb-12 w-full grow"
        columnWrapperClassName="gap-0"
        ListHeaderComponent={
          <StampDetailHeader stamp={stamp} tripName={trip?.name} />
        }
        ListEmptyComponent={
          <StateView
            compact
            title="最初の一枚を楽しみに"
            description="最初の写真を投稿して、スタンプを達成しましょう。"
            action={{
              label: '写真を投稿',
              onPress: openPost,
            }}
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
                  params: { postId: item.id, source: 'stamp', stampId },
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
