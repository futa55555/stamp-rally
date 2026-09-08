import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSegments } from 'expo-router';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useNotifications } from '../../features/notifications/hooks';
import { useAppTheme } from '../../shared/theme/ThemeProvider';

export const unstable_settings = { initialRouteName: 'trips' };

export default function MainLayout() {
  const segments = useSegments();
  const theme = useAppTheme();
  const unreadCount = useNotifications().filter(
    (notification) => !notification.readAt,
  ).length;

  return (
    <NativeTabs
      hidden={segments.some((segment) => segment === 'photo')}
      backBehavior="initialRoute"
      backgroundColor={theme.colors.surface}
      tintColor={theme.colors.primary}
      iconColor={{
        default: theme.colors.textMuted,
        selected: theme.colors.primary,
      }}
      labelStyle={{
        default: { color: theme.colors.textMuted },
        selected: { color: theme.colors.primary },
      }}
      indicatorColor={theme.colors.surfaceSubtle}
      rippleColor={theme.colors.surfaceSubtle}
      shadowColor={theme.colors.border}
      badgeBackgroundColor={theme.colors.unread}
      badgeTextColor={theme.colors.onUnread}
      labelVisibilityMode="labeled"
      disableTransparentOnScrollEdge
    >
      <NativeTabs.Trigger name="trips">
        <NativeTabs.Trigger.Label>旅行</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="bag-suitcase-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="bag-suitcase"
              />
            ),
          }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>お知らせ</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="bell-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="bell"
              />
            ),
          }}
        />
        <NativeTabs.Trigger.Badge hidden={unreadCount === 0}>
          {unreadCount > 0 ? String(unreadCount) : undefined}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>設定</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          src={{
            default: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="cog-outline"
              />
            ),
            selected: (
              <NativeTabs.Trigger.VectorIcon
                family={MaterialCommunityIcons}
                name="cog"
              />
            ),
          }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
