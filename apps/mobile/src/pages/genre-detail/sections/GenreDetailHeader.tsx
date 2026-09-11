import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Genre } from '../../../features/trips/model/types';
import { AppText } from '../../../shared/ui/AppText';
import { Progress } from '../../../shared/ui/Progress';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
export function GenreDetailHeader({
  genre,
  genreId,
  tripName,
  stampCount,
}: {
  genre: Genre;
  genreId: string;
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
      <EditableTitle title={genre.name} kind="genre" id={genreId} />
      {genre.description ? (
        <AppText tone="textSecondary">{genre.description}</AppText>
      ) : null}
      <Progress
        completed={genre.completedStampCount}
        total={genre.totalStampCount}
        label="スタンプ達成"
      />
      <View className="mt-2">
        <SectionHeading
          title="このジャンルのスタンプ"
          action={{
            label: 'スタンプを追加',
            onPress: () =>
              router.push({
                pathname: '/editor/stamp',
                params: { genreId },
              }),
          }}
          count={stampCount}
        />
      </View>
    </View>
  );
}
