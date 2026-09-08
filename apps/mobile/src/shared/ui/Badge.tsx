import { View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function Badge({
  label,
  icon,
  kind = 'active',
}: {
  label: string;
  icon?: IconName;
  kind?: 'active' | 'neutral' | 'favorite';
}) {
  const theme = useAppTheme();
  const tone =
    kind === 'active'
      ? 'active'
      : kind === 'favorite'
        ? 'favorite'
        : 'textSecondary';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.xxs,
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxs,
        borderRadius: theme.radius.pill,
        backgroundColor:
          kind === 'favorite'
            ? theme.colors.favoriteBackground
            : kind === 'active'
              ? theme.colors.activeBackground
              : theme.colors.background,
        alignSelf: 'flex-start',
      }}
    >
      {icon ? <Icon name={icon} size={14} tone={tone} /> : null}
      <AppText variant="caption" tone={tone} style={{ fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}
