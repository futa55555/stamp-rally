import { useLocalSearchParams, useRouter } from 'expo-router';
import { PostAction } from '../../features/editor/ui/EntryActions';
import { useTrip } from '../../features/trips/hooks';
import { useToday } from '../../shared/hooks/useToday';
import { Screen } from '../../shared/ui/Screen';
import { StateView } from '../../shared/ui/StateView';
import { FavoritePhotosSection } from './sections/FavoritePhotosSection';
import { GenresSection } from './sections/GenresSection';
import { TripDetailHeader } from './sections/TripDetailHeader';

export function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { trip, genres, favorites, members } = useTrip(tripId);
  const today = useToday();
  if (!trip)
    return (
      <StateView
        title="旅行が見つかりません"
        description="旅行一覧から選び直してください。"
        action={{
          label: '旅行一覧へ',
          onPress: () => router.dismissTo('/trips'),
        }}
      />
    );
  return (
    <>
      <PostAction scope={{ tripId }} />
      <Screen>
        <TripDetailHeader
          trip={trip}
          tripId={tripId}
          members={members}
          today={today}
        />
        <FavoritePhotosSection favorites={favorites} />
        <GenresSection tripId={tripId} genres={genres} />
      </Screen>
    </>
  );
}
