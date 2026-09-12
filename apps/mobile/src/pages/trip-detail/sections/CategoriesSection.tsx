import { Progress } from '../../../shared/ui/Progress';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { useTrip } from '../../../features/trips/hooks';
import { ListRow } from '../../../shared/ui/ListRow';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
import { StateView } from '../../../shared/ui/StateView';

export function CategoriesSection({
  tripId,
  categories,
}: {
  tripId: string;
  categories: ReturnType<typeof useTrip>['categories'];
}) {
  const router = useRouter();
  return (
    <View className="gap-4 px-4">
      <SectionHeading
        title="カテゴリー"
        action={{
          label: 'カテゴリーを追加',
          onPress: () =>
            router.push({ pathname: '/editor/category', params: { tripId } }),
        }}
      />
      {categories.map((category) => (
        <ListRow
          key={category.id}
          title={category.name}
          icon="compass-outline"
          unread={category.unread}
          onPress={() =>
            router.push({
              pathname: '/trips/category/[categoryId]',
              params: { categoryId: category.id },
            })
          }
        >
          <Progress
            completed={category.completedStampCount}
            total={category.totalStampCount}
            label="スタンプ達成"
          />
        </ListRow>
      ))}
      {!categories.length ? (
        <StateView
          compact
          title="旅の楽しみは、これから"
          description="カテゴリーを作って、旅の楽しみを増やしましょう。"
          action={{
            label: 'カテゴリーを追加',
            onPress: () =>
              router.push({
                pathname: '/editor/category',
                params: { tripId },
              }),
          }}
          icon="compass-outline"
        />
      ) : null}
    </View>
  );
}
