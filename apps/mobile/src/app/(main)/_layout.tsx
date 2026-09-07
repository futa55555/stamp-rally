import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useAppTheme } from "../../theme/ThemeProvider";
import { useNotifications } from "../../features/hooks";

export const unstable_settings = { initialRouteName: "trips" };

export default function MainLayout() {
  const theme = useAppTheme();
  const unread = useNotifications().some(
    (notification) => !notification.readAt,
  );

  return (
    <NativeTabs
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
        <NativeTabs.Trigger.Badge hidden={!unread} />
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
