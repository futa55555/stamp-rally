import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { useTrip } from '../../../features/trips/hooks';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { ListRow } from '../../../shared/ui/ListRow';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
import { StateView } from '../../../shared/ui/StateView';

export function GenresSection({
  tripId,
  genres,
}: {
  tripId: string;
  genres: ReturnType<typeof useTrip>['genres'];
}) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHeading
        title="ジャンル"
        action={{
          label: 'ジャンルを追加',
          onPress: () =>
            router.push({ pathname: '/editor/genre', params: { tripId } }),
        }}
        subtitle="小さな寄り道を、ひとつずつ。"
        count={genres.length}
      />
      {genres.map((genre) => (
        <ListRow
          key={genre.id}
          title={genre.name}
          subtitle={`${genre.completedStampCount} / ${genre.totalStampCount} スタンプ達成`}
          icon="compass-outline"
          completed={genre.isCompleted}
          unread={genre.unread}
          onPress={() =>
            router.push({
              pathname: '/trips/genre/[genreId]',
              params: { genreId: genre.id },
            })
          }
        />
      ))}
      {!genres.length ? (
        <StateView
          compact
          title="旅の楽しみは、これから"
          description="ジャンルを作って、旅の楽しみを増やしましょう。"
          action={{
            label: 'ジャンルを追加',
            onPress: () =>
              router.push({
                pathname: '/editor/genre',
                params: { tripId },
              }),
          }}
          icon="compass-outline"
        />
      ) : null}
    </View>
  );
}
