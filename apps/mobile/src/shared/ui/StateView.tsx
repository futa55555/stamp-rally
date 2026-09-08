import { ActivityIndicator, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Button } from './Button';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function StateView({
  title,
  description,
  icon = 'image-multiple-outline',
  loading = false,
  action,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: IconName;
  loading?: boolean;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={{
        padding: compact ? theme.spacing.lg : theme.spacing.xxl,
        gap: theme.spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        flex: compact ? undefined : 1,
        backgroundColor: theme.colors.background,
        borderRadius: theme.radius.md,
      }}
    >
      {loading ? (
        <ActivityIndicator
          color={theme.colors.primary}
          accessibilityLabel="読み込み中"
        />
      ) : (
        <Icon name={icon} size={36} tone="textMuted" />
      )}
      <AppText
        variant="label"
        accessibilityRole="header"
        style={{ textAlign: 'center' }}
      >
        {title}
      </AppText>
      {description ? (
        <AppText
          tone="textSecondary"
          variant="caption"
          style={{ textAlign: 'center' }}
        >
          {description}
        </AppText>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}
