import { useRouter } from 'expo-router';
import { Button } from '../../../shared/ui/Button';
import { View } from 'react-native';
import type { User } from '../../../features/auth/model/types';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Trip } from '../../../features/trips/model/types';
import { TripMetadata } from '../../../features/trips/ui/TripMetadata';
export function TripDetailHeader({
  trip,
  members,
}: {
  trip: Trip;
  members: User[];
}) {
  const router = useRouter();
  return (
    <View className="gap-4 px-4">
      <EditableTitle title={trip.name} kind="trip" id={trip.id} />
      <TripMetadata trip={trip} members={members} />
      <Button
        label="招待・参加申請"
        variant="secondary"
        onPress={() =>
          router.push({
            pathname: '/invitations/trip/[tripId]',
            params: { tripId: trip.id },
          })
        }
      />
    </View>
  );
}
