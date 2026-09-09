import { QueryState } from '../../shared/ui/QueryState';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useGenre } from '../../features/trips/hooks';
import { StampCard } from './components/StampCard';
import { useRepresentativePhotos } from '../../features/photos/hooks/useRepresentativePhotos';
import { StateView } from '../../shared/ui/StateView';
import { GenreDetailHeader } from './sections/GenreDetailHeader';

export function GenreDetailScreen() {
  const router = useRouter();
  const { genreId } = useLocalSearchParams<{ genreId: string }>();
  const query = useGenre(genreId);
  const refresh = usePullToRefresh(query.invalidate);
  const { genre, stamps } = query;
  const representatives = useRepresentativePhotos(stamps);
  if (query.isPending || query.error) return <QueryState query={query} />;
  if (!genre)
    return (
      <StateView
        title="ジャンルが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <>
      <FlatList
        {...refresh}
        data={stamps.length % 2 ? [...stamps, null] : stamps}
        numColumns={2}
        columnWrapperClassName="gap-4"
        keyExtractor={(stamp) => stamp?.id ?? 'empty-cell'}
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pt-6 pb-12 gap-6 w-full"
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
        renderItem={({ item }) =>
          item ? (
            <StampCard stamp={item} photo={representatives[item.id]} />
          ) : (
            <View className="flex-1" />
          )
        }
      />
    </>
  );
}
