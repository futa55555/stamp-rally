import { View } from 'react-native';
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
  if (!total)
    return (
      <AppText variant="caption" tone="textSecondary">
        まだスタンプがありません
      </AppText>
    );
  return (
    <View className="gap-2">
      <View className="flex-row justify-between gap-3">
        <AppText variant="caption" tone="textSecondary" className="flex-1">
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
          max: total,
          now: completed,
          text: total + '件中' + completed + '件達成',
        }}
        className="h-1 overflow-hidden rounded-full bg-border"
      >
        <View
          className="h-full rounded-full bg-primary"
          style={{
            width: (Math.min(100, (completed / total) * 100) +
              '%') as `${number}%`,
          }}
        />
      </View>
    </View>
  );
}
