import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { PostAction } from '../../features/editor/ui/EntryActions';
import { PhotoTile } from '../../features/photos/ui/PhotoTile';
import { useStamp } from '../../features/trips/hooks';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { StateView } from '../../shared/ui/StateView';
import { StampDetailHeader } from './sections/StampDetailHeader';

export function StampDetailScreen() {
  const router = useRouter();
  const { stampId } = useLocalSearchParams<{ stampId: string }>();
  const theme = useAppTheme();
  const { stamp, genre, photos } = useStamp(stampId);
  if (!stamp)
    return (
      <StateView
        title="スタンプが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <>
      <PostAction
        scope={{ tripId: genre!.tripId, genreId: stamp.genreId, stampId }}
      />
      <FlatList
        data={photos.length % 2 ? [...photos, null] : photos}
        numColumns={2}
        keyExtractor={(photo) => photo?.id ?? 'empty-cell'}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.md,
          width: '100%',
          maxWidth: theme.layout.pageMaxWidth,
          alignSelf: 'center',
          flexGrow: 1,
        }}
        columnWrapperStyle={{ gap: theme.spacing.sm }}
        ListHeaderComponent={
          <StampDetailHeader
            stamp={stamp}
            stampId={stampId}
            genreName={genre?.name}
            photoCount={photos.length}
          />
        }
        ListEmptyComponent={
          <StateView
            compact
            title="最初の一枚を楽しみに"
            description="最初の写真を投稿して、スタンプを達成しましょう。"
            action={{
              label: '写真を投稿',
              onPress: () =>
                router.push({ pathname: '/editor/post', params: { stampId } }),
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
                  params: { postId: item.id },
                })
              }
            />
          ) : (
            <View style={{ flex: 1 }} />
          )
        }
      />
    </>
  );
}
