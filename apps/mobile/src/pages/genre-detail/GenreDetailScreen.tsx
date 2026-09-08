import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import { PostAction } from '../../features/editor/ui/EntryActions';
import { useGenre } from '../../features/trips/hooks';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { ListRow } from '../../shared/ui/ListRow';
import { StateView } from '../../shared/ui/StateView';
import { GenreDetailHeader } from './sections/GenreDetailHeader';

export function GenreDetailScreen() {
  const router = useRouter();
  const { genreId } = useLocalSearchParams<{ genreId: string }>();
  const theme = useAppTheme();
  const { genre, stamps } = useGenre(genreId);
  if (!genre)
    return (
      <StateView
        title="ジャンルが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <>
      <PostAction scope={{ tripId: genre.tripId, genreId }} />
      <FlatList
        data={stamps}
        keyExtractor={(stamp) => stamp.id}
        style={{ flex: 1, backgroundColor: theme.colors.background }}
        contentContainerStyle={{
          padding: theme.spacing.lg,
          paddingBottom: theme.spacing.xxl,
          gap: theme.spacing.sm,
          width: '100%',
          maxWidth: theme.layout.pageMaxWidth,
          alignSelf: 'center',
          flexGrow: 1,
        }}
        ListHeaderComponent={
          <GenreDetailHeader
            genre={genre}
            genreId={genreId}
            stampCount={stamps.length}
          />
        }
        ListEmptyComponent={
          <StateView
            compact
            title="まだスタンプがありません"
            description="スタンプを作って、写真を投稿しましょう。"
            action={{
              label: 'スタンプを追加',
              onPress: () =>
                router.push({ pathname: '/editor/stamp', params: { genreId } }),
            }}
            icon="postage-stamp"
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={
              item.isCompleted
                ? `${item.photoCount}枚の写真 · 達成済み`
                : 'まだ写真がありません'
            }
            icon="postage-stamp"
            completed={item.isCompleted}
            unread={item.unread}
            onPress={() =>
              router.push({
                pathname: '/trips/stamp/[stampId]',
                params: { stampId: item.id },
              })
            }
          />
        )}
      />
    </>
  );
}
