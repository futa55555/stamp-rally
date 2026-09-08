import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { isActiveTrip } from '../../../features/trips/model/selectors';
import type { Trip } from '../../../features/trips/model/types';
import { dateRange } from '../../../shared/lib/dates';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Badge } from '../../../shared/ui/Badge';
import { Icon } from '../../../shared/ui/Icon';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { Progress } from '../../../shared/ui/Progress';
export function TripCard({ trip, today }: { trip: Trip; today: string }) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${trip.name}、${isActiveTrip(trip, today) ? '旅行中、' : ''}${dateRange(trip.startDate, trip.endDate)}`}
      onPress={() =>
        router.push({
          pathname: '/trips/trip/[tripId]',
          params: { tripId: trip.id },
        })
      }
      style={({ pressed }) => ({
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
        opacity: pressed ? theme.opacity.pressed : 1,
      })}
    >
      <View>
        <PhotoImage url={trip.coverImageUrl} style={{ height: 204 }} />
        <View
          style={{
            position: 'absolute',
            left: theme.spacing.md,
            top: theme.spacing.md,
          }}
        >
          <Badge
            label={
              isActiveTrip(trip, today)
                ? '旅行中'
                : trip.startDate > today
                  ? 'これからの旅'
                  : '旅の思い出'
            }
            icon={
              isActiveTrip(trip, today)
                ? 'circle-small'
                : 'calendar-blank-outline'
            }
            kind={isActiveTrip(trip, today) ? 'active' : 'neutral'}
          />
        </View>
      </View>
      <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <AppText variant="heading" style={{ flex: 1 }}>
            {trip.name}
          </AppText>
          <Icon name="arrow-top-right" size={22} tone="primary" />
        </View>
        <AppText variant="caption" tone="textSecondary">
          {dateRange(trip.startDate, trip.endDate)}
        </AppText>
        <Progress
          completed={trip.completedGenreCount}
          total={trip.totalGenreCount}
          label="ジャンル達成"
        />
      </View>
    </Pressable>
  );
}
