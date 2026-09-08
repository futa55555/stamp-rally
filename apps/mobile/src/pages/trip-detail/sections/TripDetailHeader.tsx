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
  return (
    <View className="gap-4 px-4">
      <EditableTitle title={trip.name} kind="trip" id={trip.id} />
      <TripMetadata trip={trip} members={members} />
    </View>
  );
}
