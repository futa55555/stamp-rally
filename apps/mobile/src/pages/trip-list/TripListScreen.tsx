import { QueryState } from '../../shared/ui/QueryState';
import { View } from 'react-native';
import { useTrips } from '../../features/trips/hooks';
import { groupTrips } from '../../features/trips/model/selectors';
import { AppText } from '../../shared/ui/AppText';
import { Screen } from '../../shared/ui/Screen';
import { SectionHeading } from '../../shared/ui/SectionHeading';
import { TripCard } from './components/TripCard';
import { CreateTripButton } from './components/CreateTripButton';

export function TripListScreen() {
  const query = useTrips();
  const { trips, today } = query;
  const { active, upcoming, past } = groupTrips(trips, today);
  if (query.isPending || query.error) return <QueryState query={query} />;
  return (
    <Screen
      refreshing={query.isFetching}
      onRefresh={() => {
        void query.refetch();
      }}
      contentContainerClassName="pt-6"
    >
      {active.length ? (
        <View className="gap-4 px-4">
          <SectionHeading title="旅行中" />
          {active.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </View>
      ) : null}
      <View className="gap-6 px-4">
        <View className="gap-4">
          <SectionHeading title="あなたの旅行" />
          <CreateTripButton />
        </View>
        {[
          { title: 'これからの旅行', trips: upcoming },
          { title: '過去の旅行', trips: past },
        ].map((group) =>
          group.trips.length ? (
            <View key={group.title} className="gap-4">
              <AppText
                variant="label"
                tone="textSecondary"
                accessibilityRole="header"
              >
                {group.title}
              </AppText>
              {group.trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </View>
          ) : null,
        )}
      </View>
    </Screen>
  );
}
