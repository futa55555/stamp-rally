import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Stamp } from '../../../features/trips/model/types';
import { AppText } from '../../../shared/ui/AppText';
export function StampDetailHeader({
  stamp,
  tripName,
}: {
  stamp: Stamp;
  tripName?: string;
}) {
  return (
    <View className="gap-4 px-4 py-6">
      <AppText variant="caption" tone="primary">
        {tripName}
      </AppText>
      <EditableTitle title={stamp.name} kind="stamp" id={stamp.id} />
      {stamp.description ? (
        <AppText tone="textSecondary">{stamp.description}</AppText>
      ) : null}
    </View>
  );
}
