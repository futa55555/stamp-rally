import { Progress } from '../../../shared/ui/Progress';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import type { useTrip } from '../../../features/trips/hooks';
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
  const router = useRouter();
  return (
    <View className="gap-4 px-4">
      <SectionHeading
        title="ジャンル"
        action={{
          label: 'ジャンルを追加',
          onPress: () =>
            router.push({ pathname: '/editor/genre', params: { tripId } }),
        }}
      />
      {genres.map((genre) => (
        <ListRow
          key={genre.id}
          title={genre.name}
          icon="compass-outline"
          unread={genre.unread}
          onPress={() =>
            router.push({
              pathname: '/trips/genre/[genreId]',
              params: { genreId: genre.id },
            })
          }
        >
          <Progress
            completed={genre.completedStampCount}
            total={genre.totalStampCount}
            label="スタンプ達成"
          />
        </ListRow>
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
