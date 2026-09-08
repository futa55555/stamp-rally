import { View } from 'react-native';
import type { User } from '../../../features/auth/model/types';
import { EditableTitle } from '../../../features/editor/ui/EntryActions';
import { isActiveTrip } from '../../../features/trips/model/selectors';
import type { Trip } from '../../../features/trips/model/types';
import { dateRange } from '../../../shared/lib/dates';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { Progress } from '../../../shared/ui/Progress';
export function TripDetailHeader({
  trip,
  tripId,
  members,
  today,
}: {
  trip: Trip;
  tripId: string;
  members: User[];
  today: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md }}>
      <PhotoImage
        url={trip.coverImageUrl}
        label={trip.name}
        style={{ height: 230, borderRadius: theme.radius.lg }}
      />
      {isActiveTrip(trip, today) ? (
        <Badge label="旅行中" icon="circle-small" />
      ) : null}
      <EditableTitle title={trip.name} kind="trip" id={tripId} />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Icon name="calendar-blank-outline" size={17} />
        <AppText variant="caption" tone="textSecondary" style={{ flex: 1 }}>
          {dateRange(trip.startDate, trip.endDate)}
        </AppText>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <Icon name="account-group-outline" size={18} />
        <AppText variant="caption" tone="textSecondary" style={{ flex: 1 }}>
          {members.map((u) => u.name ?? '旅の仲間').join('・')}
        </AppText>
      </View>
      <Progress
        completed={trip.completedGenreCount}
        total={trip.totalGenreCount}
        label="旅の達成状況"
      />
    </View>
  );
}
