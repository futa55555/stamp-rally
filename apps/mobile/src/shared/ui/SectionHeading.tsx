import { View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
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
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xxs }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xs,
        }}
      >
        <AppText
          variant="heading"
          accessibilityRole="header"
          style={{ flex: 1 }}
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
