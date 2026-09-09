import { UploadSummary } from '../../features/uploads/UploadSummary';
import { View } from 'react-native';
import { useTrips } from '../../features/trips/hooks';
import { groupTrips } from '../../features/trips/model/selectors';
import type { Trip } from '../../features/trips/model/types';
import { AppText } from '../../shared/ui/AppText';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ListScreen } from '../../shared/ui/ListScreen';
import { QueryState } from '../../shared/ui/QueryState';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { SectionHeading } from '../../shared/ui/SectionHeading';
import { TripCard } from './components/TripCard';
import { CreateTripButton } from './components/CreateTripButton';

type TripListRow =
  { type: 'create' } | { type: 'trip'; trip: Trip; heading?: string };

function tripRows(trips: Trip[], heading: string): TripListRow[] {
  return trips.map((trip, index) => ({
    type: 'trip',
    trip,
    heading: index === 0 ? heading : undefined,
  }));
}

export function TripListScreen() {
  const query = useTrips();
  const refresh = usePullToRefresh(query.refetch);
  const { trips, today } = query;
  const { active, upcoming, past } = groupTrips(trips, today);
  if (query.isPending || query.error) return <QueryState query={query} />;
  const rows: TripListRow[] = trips.length
    ? [
        ...tripRows(active, '旅行中'),
        { type: 'create' },
        ...tripRows(upcoming, 'これからの旅行'),
        ...tripRows(past, '過去の旅行'),
      ]
    : [];
  return (
    <ListScreen
      data={rows}
      ListHeaderComponent={<UploadSummary />}
      keyExtractor={(row) =>
        row.type === 'create' ? 'create' : `trip-${row.trip.id}`
      }
      {...refresh}
      ListEmptyComponent={
        <EmptyState
          title="次の旅を、ここから。"
          description="行きたい場所や、やってみたいこと。旅行を作って、旅の楽しみを集めましょう。"
          icon="bag-suitcase-outline"
          accentIcon="map-marker-outline"
        >
          <CreateTripButton />
        </EmptyState>
      }
      renderItem={({ item }) =>
        item.type === 'create' ? (
          <View className="gap-4">
            <SectionHeading title="あなたの旅行" />
            <CreateTripButton />
          </View>
        ) : (
          <View className="gap-4">
            {item.heading === '旅行中' ? (
              <SectionHeading title={item.heading} />
            ) : item.heading ? (
              <AppText
                variant="label"
                tone="textSecondary"
                accessibilityRole="header"
              >
                {item.heading}
              </AppText>
            ) : null}
            <TripCard trip={item.trip} />
          </View>
        )
      }
    />
  );
}
