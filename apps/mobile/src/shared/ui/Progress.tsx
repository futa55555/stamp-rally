import { View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

export function Progress({
  completed,
  total,
  label,
}: {
  completed: number;
  total: number;
  label: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: theme.spacing.sm,
        }}
      >
        <AppText variant="caption" tone="textSecondary">
          {label}
        </AppText>
        <AppText variant="caption" tone="primary">
          {completed} / {total}
        </AppText>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{
          min: 0,
          max: total || 1,
          now: completed,
          text: `${total}件中${completed}件達成`,
        }}
        style={{
          height: 4,
          backgroundColor: theme.colors.border,
          borderRadius: theme.radius.pill,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            height: '100%',
            width: `${total ? Math.min(100, (completed / total) * 100) : 0}%`,
            backgroundColor: theme.colors.primary,
            borderRadius: theme.radius.pill,
          }}
        />
      </View>
    </View>
  );
}
