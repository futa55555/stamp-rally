import { View } from 'react-native';
import type { User } from '../../auth/model/types';
import type { Trip } from '../model/types';
import { dateRange } from '../../../shared/lib/dates';
import { AppText } from '../../../shared/ui/AppText';
import { Icon, type IconName } from '../../../shared/ui/Icon';

export function TripMetadata({
  trip,
  members,
}: {
  trip: Trip;
  members: User[];
}) {
  const rows: { icon: IconName; label: string; value: string }[] = [
    {
      icon: 'calendar-blank-outline',
      label: '日程',
      value: dateRange(trip.startDate, trip.endDate),
    },
    {
      icon: 'account-group-outline',
      label: '参加者',
      value:
        members.map((member) => member.name ?? '旅の仲間').join(', ') ||
        '未設定',
    },
    {
      icon: 'map-marker-outline',
      label: '行き先',
      value: trip.locations?.join(', ') || '未設定',
    },
  ];
  return (
    <View className="gap-2">
      {rows.map((row) => (
        <View key={row.label} className="flex-row items-start gap-2">
          <Icon name={row.icon} size={18} />
          <AppText
            variant="caption"
            tone="textSecondary"
            accessibilityLabel={row.label + '、' + row.value}
            className="flex-1"
          >
            {row.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}
