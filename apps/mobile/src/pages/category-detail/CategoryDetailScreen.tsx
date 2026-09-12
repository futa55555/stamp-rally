import { QueryState } from '../../shared/ui/QueryState';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { useCategory } from '../../features/trips/hooks';
import { useTripHeader } from '../../features/trips/navigation/useTripHeader';
import { StampCard } from './components/StampCard';
import { useRepresentativePhotos } from '../../features/photos/hooks/useRepresentativePhotos';
import { StateView } from '../../shared/ui/StateView';
import { CategoryDetailHeader } from './sections/CategoryDetailHeader';

export function CategoryDetailScreen() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const query = useCategory(categoryId);
  const refresh = usePullToRefresh(query.invalidate);
  const { category, trip, stamps } = query;
  useTripHeader({
    title: category?.name ?? 'カテゴリー',
    trip,
    category,
    categoryId,
  });
  const representatives = useRepresentativePhotos(stamps);
  if (query.isPending || query.error) return <QueryState query={query} />;
  if (!category)
    return (
      <StateView
        title="カテゴリーが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        {...refresh}
        data={stamps.length % 2 ? [...stamps, null] : stamps}
        numColumns={2}
        columnWrapperClassName="gap-4"
        keyExtractor={(stamp) => stamp?.id ?? 'empty-cell'}
        className="flex-1 bg-background"
        contentContainerClassName="px-4 pt-6 pb-12 gap-6 w-full"
        ListHeaderComponent={
          <CategoryDetailHeader
            category={category}
            categoryId={categoryId}
            tripName={trip?.name}
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
                router.push({
                  pathname: '/editor/stamp',
                  params: { categoryId },
                }),
            }}
            icon="postage-stamp"
          />
        }
        renderItem={({ item }) =>
          item ? (
            <StampCard
              stamp={item}
              photo={representatives[item.id]}
              categoryId={categoryId}
            />
          ) : (
            <View className="flex-1" />
          )
        }
      />
    </>
  );
}
