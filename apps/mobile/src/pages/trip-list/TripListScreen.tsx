import { useRouter } from 'expo-router';
import { FlatList } from 'react-native';
import { useTrips } from '../../features/trips/hooks';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { StateView } from '../../shared/ui/StateView';
import { TripCard } from './components/TripCard';
import { TripListHeader } from './sections/TripListHeader';

export function TripListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { trips, today } = useTrips();
  return (
    <FlatList
      data={trips}
      keyExtractor={(trip) => trip.id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.lg,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
        flexGrow: 1,
      }}
      ListHeaderComponent={<TripListHeader tripCount={trips.length} />}
      ListEmptyComponent={
        <StateView
          title="まだ旅行がありません"
          description="旅行を作成して、思い出を集めましょう。"
          action={{
            label: '旅行を作成',
            onPress: () => router.push('/editor/trip'),
          }}
          icon="bag-suitcase-outline"
          compact
        />
      }
      renderItem={({ item: trip }) => <TripCard trip={trip} today={today} />}
    />
  );
}
