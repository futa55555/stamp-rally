import { View } from 'react-native';
import { AppText } from './AppText';
import { IconButton } from './IconButton';

export function SectionHeading({
  title,
  subtitle,
  count,
  action,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View className="gap-1">
      <View className="flex-row items-center gap-2">
        <AppText
          variant="heading"
          accessibilityRole="header"
          className="flex-1"
        >
          {title}
        </AppText>
        {count !== undefined ? (
          <AppText variant="caption" tone="textMuted">
            {count}
          </AppText>
        ) : null}
        {action ? (
          <IconButton
            icon="plus"
            label={action.label}
            onPress={action.onPress}
            tone="primary"
          />
        ) : null}
      </View>
      {subtitle ? (
        <AppText variant="caption" tone="textSecondary">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );
}
