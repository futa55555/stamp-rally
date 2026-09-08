import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
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
  children,
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  unread?: boolean;
  completed?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Pressable
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        title + (subtitle ? '、' + subtitle : '') + (unread ? '、未読あり' : '')
      }
      className="min-h-[88px] flex-row items-center gap-4 rounded-2xl bg-surface p-4 active:bg-surfaceSubtle"
    >
      <View className="h-11 w-11 items-center justify-center rounded-lg bg-surfaceSubtle">
        <Icon
          name={completed ? 'check-circle-outline' : icon}
          tone="primary"
          size={23}
        />
      </View>
      <View className="flex-1 gap-2">
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" tone="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </View>
      {unread ? <UnreadBadge /> : null}
      {trailing ??
        (onPress ? (
          <Icon name="chevron-right" size={20} tone="textMuted" />
        ) : null)}
    </Pressable>
  );
}
