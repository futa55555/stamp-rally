import type { ReactNode } from 'react';
import { View } from 'react-native';
import { AppText } from './AppText';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function EmptyState({
  title,
  description,
  icon,
  accentIcon,
  children,
}: {
  title: string;
  description: string;
  icon: IconName;
  accentIcon: IconName;
  children?: ReactNode;
}) {
  return (
    <View className="w-full max-w-[320px] self-center items-center gap-8">
      <View
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        className="h-40 w-40 items-center justify-center"
      >
        <View className="absolute h-36 w-36 rounded-full bg-surfaceSubtle" />
        <View className="h-28 w-24 -rotate-6 items-center justify-center gap-3 rounded-3xl border border-border bg-surface">
          <Icon name={icon} size={44} tone="primary" />
          <View className="h-1 w-8 rounded-full bg-surfaceSubtle" />
        </View>
        <View className="absolute bottom-1 right-1 h-12 w-12 rotate-12 items-center justify-center rounded-2xl border-4 border-background bg-favoriteBackground">
          <Icon name={accentIcon} size={24} tone="primary" />
        </View>
      </View>
      <View className="w-full items-center gap-3">
        <AppText
          variant="heading"
          accessibilityRole="header"
          className="w-full text-center"
        >
          {title}
        </AppText>
        <AppText tone="textSecondary" className="w-full text-center">
          {description}
        </AppText>
      </View>
      {children ? <View className="w-full">{children}</View> : null}
    </View>
  );
}
