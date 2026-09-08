import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Genre } from '../../../features/trips/model/types';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Progress } from '../../../shared/ui/Progress';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
export function GenreDetailHeader({
  genre,
  genreId,
  stampCount,
}: {
  genre: Genre;
  genreId: string;
  stampCount: number;
}) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
      <AppText variant="eyebrow" tone="primary">
        EXPLORE & COLLECT
      </AppText>
      <EditableTitle title={genre.name} kind="genre" id={genreId} />
      {genre.description ? (
        <AppText tone="textSecondary">{genre.description}</AppText>
      ) : null}
      <Progress
        completed={genre.completedStampCount}
        total={genre.totalStampCount}
        label="スタンプ達成"
      />
      <View style={{ marginTop: theme.spacing.lg }}>
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
