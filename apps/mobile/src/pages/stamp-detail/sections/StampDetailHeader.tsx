import { View } from 'react-native';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import type { Stamp } from '../../../features/trips/model/types';
import { AppText } from '../../../shared/ui/AppText';
export function StampDetailHeader({
  stamp,
  tripName,
  genreNames,
  viaGenreId,
}: {
  stamp: Stamp;
  tripName?: string;
  genreNames: string[];
  viaGenreId?: string;
}) {
  return (
    <View className="gap-4 px-4 py-6">
      <View className="gap-1">
        {tripName ? (
          <AppText variant="caption" tone="primary">
            {tripName}
          </AppText>
        ) : null}
        <AppText variant="caption" tone="textSecondary">
          {genreNames.join(', ')}
        </AppText>
      </View>
      <EditableTitle
        title={stamp.name}
        kind="stamp"
        id={stamp.id}
        viaGenreId={viaGenreId}
      />
      {stamp.description ? (
        <AppText tone="textSecondary">{stamp.description}</AppText>
      ) : null}
    </View>
  );
}
