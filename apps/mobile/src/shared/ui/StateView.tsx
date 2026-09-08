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
      className={[
        'gap-4 items-center justify-center bg-background rounded-2xl',
        compact ? 'p-6' : 'flex-1 px-4 py-12',
      ].join(' ')}
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
        className="text-center"
      >
        {title}
      </AppText>
      {description ? (
        <AppText tone="textSecondary" variant="caption" className="text-center">
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
