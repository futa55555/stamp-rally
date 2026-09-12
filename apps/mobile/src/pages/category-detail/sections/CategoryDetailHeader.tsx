import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Category } from '../../../features/trips/model/types';
import { AppText } from '../../../shared/ui/AppText';
import { Progress } from '../../../shared/ui/Progress';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
export function CategoryDetailHeader({
  category,
  categoryId,
  tripName,
  stampCount,
}: {
  category: Category;
  categoryId: string;
  tripName?: string;
  stampCount: number;
}) {
  const router = useRouter();
  return (
    <View className="gap-4">
      {tripName ? (
        <AppText variant="caption" tone="primary">
          {tripName}
        </AppText>
      ) : null}
      <EditableTitle title={category.name} kind="category" id={categoryId} />
      {category.description ? (
        <AppText tone="textSecondary">{category.description}</AppText>
      ) : null}
      <Progress
        completed={category.completedStampCount}
        total={category.totalStampCount}
        label="スタンプ達成"
      />
      <View className="mt-2">
        <SectionHeading
          title="このカテゴリーのスタンプ"
          action={{
            label: 'スタンプを追加',
            onPress: () =>
              router.push({
                pathname: '/editor/stamp',
                params: { categoryId },
              }),
          }}
          count={stampCount}
        />
      </View>
    </View>
  );
}
