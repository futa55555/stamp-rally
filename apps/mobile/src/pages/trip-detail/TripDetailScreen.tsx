import { QueryState } from '../../shared/ui/QueryState';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTrip } from '../../features/trips/hooks';
import { useTripHeader } from '../../features/trips/navigation/useTripHeader';
import { TripCoverImage } from '../../features/trip-covers/TripCoverImage';
import { Screen } from '../../shared/ui/Screen';
import { StateView } from '../../shared/ui/StateView';
import { FavoritePhotosSection } from './sections/FavoritePhotosSection';
import { CategoriesSection } from './sections/CategoriesSection';
import { TripDetailHeader } from './sections/TripDetailHeader';

export function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const query = useTrip(tripId);
  const refresh = usePullToRefresh(query.invalidate);
  const { trip, categories, favorites, members } = query;
  useTripHeader({ title: trip?.name ?? '旅行', trip, tripId });
  if (query.isPending || query.error) return <QueryState query={query} />;
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
      <Screen
        {...refresh}
        contentContainerClassName={trip.coverImageUrl ? '' : 'pt-6'}
      >
        {trip.coverImageUrl ? (
          <TripCoverImage
            trip={trip}
            label={trip.name}
            className="w-full aspect-[1.6]"
          />
        ) : null}
        <TripDetailHeader trip={trip} members={members} />
        <FavoritePhotosSection favorites={favorites} />
        <CategoriesSection tripId={tripId} categories={categories} />
      </Screen>
    </>
  );
}
