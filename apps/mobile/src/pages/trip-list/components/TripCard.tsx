import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useTrip } from '../../../features/trips/hooks';
import type { Trip } from '../../../features/trips/model/types';
import { TripMetadata } from '../../../features/trips/ui/TripMetadata';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { TripCoverImage } from '../../../features/trip-covers/TripCoverImage';

export function TripCard({ trip }: { trip: Trip }) {
  const router = useRouter();
  const { members } = useTrip(trip.id);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() =>
        router.push({
          pathname: '/trips/trip/[tripId]',
          params: { tripId: trip.id },
        })
      }
      className="overflow-hidden rounded-3xl border border-border bg-surface active:opacity-pressed"
    >
      {trip.coverImageUrl ? (
        <TripCoverImage trip={trip} className="aspect-[1.6]" />
      ) : null}
      <View className="gap-3 p-4">
        <View className="flex-row items-center gap-3">
          <AppText variant="heading" className="flex-1">
            {trip.name}
          </AppText>
          <Icon name="arrow-top-right" size={22} tone="primary" />
        </View>
        <TripMetadata trip={trip} members={members} />
      </View>
    </Pressable>
  );
}
