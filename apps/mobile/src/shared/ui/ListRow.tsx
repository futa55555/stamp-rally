import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import type { IconName } from './Icon';
import { Icon } from './Icon';
import { UnreadBadge } from './UnreadBadge';

export function ListRow({
  title,
  subtitle,
  icon,
  unread,
  completed,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  unread?: boolean;
  completed?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${title}${subtitle ? `、${subtitle}` : ''}${unread ? '、未読あり' : ''}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        padding: theme.spacing.md,
        backgroundColor: pressed
          ? theme.colors.surfaceSubtle
          : theme.colors.surface,
        borderRadius: theme.radius.md,
        minHeight: 88,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: theme.radius.sm,
          backgroundColor: theme.colors.surfaceSubtle,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon
          name={completed ? 'check-circle-outline' : icon}
          tone="primary"
          size={23}
        />
      </View>
      <View style={{ flex: 1, gap: theme.spacing.xxs }}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {unread ? <UnreadBadge /> : null}
      {trailing ??
        (onPress ? (
          <Icon name="chevron-right" size={20} tone="textMuted" />
        ) : null)}
    </Pressable>
  );
}
