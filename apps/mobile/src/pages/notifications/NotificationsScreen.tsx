import { useNavigation } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { useNotifications } from '../../features/notifications/hooks';
import type { AppNotification } from '../../features/notifications/model/types';
import { resolveTarget } from '../../features/trips/navigation/targets';
import { useTask } from '../../shared/hooks/useTask';
import { timestampLabel } from '../../shared/lib/dates';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { AppText } from '../../shared/ui/AppText';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { SectionHeading } from '../../shared/ui/SectionHeading';
import { StateView } from '../../shared/ui/StateView';
import { UnreadBadge } from '../../shared/ui/UnreadBadge';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const theme = useAppTheme();
  const notifications = useNotifications();
  const { data, userId, actions } = useData();
  const task = useTask();
  const openNotification = (notification: AppNotification) =>
    task.run(async () => {
      const routes = resolveTarget(data, notification.target, userId!);
      if (!routes)
        throw new Error(
          '通知の対象が見つかりません。すでに削除されたか、アクセスできない可能性があります。',
        );
      await actions.markNotificationRead(notification.id);
      // Replace the Trips stack with the destination and its ancestors so Back
      // follows the trip hierarchy, even when opening another trip's notification.
      navigation.getParent()?.dispatch((state) => ({
        type: 'RESET',
        payload: {
          ...state,
          index: state.routes.findIndex((r) => r.name === 'trips'),
          routes: state.routes.map((r) =>
            r.name === 'trips'
              ? { ...r, state: { index: routes.length - 1, routes } }
              : r,
          ),
        },
      }));
    });
  return (
    <FlatList
      data={notifications}
      keyExtractor={(notification) => notification.id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.sm,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
      }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.md }}>
          <SectionHeading
            title="旅の便り"
            subtitle="仲間から届いた、新しい思い出。"
          />
          <ErrorMessage message={task.error} />
        </View>
      }
      ListEmptyComponent={
        <StateView
          compact
          title="新しいお知らせはありません"
          description="旅の更新が届くと、ここに表示されます。"
          icon="bell-outline"
        />
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => {
            void openNotification(item);
          }}
          disabled={task.pending}
          accessibilityRole="button"
          accessibilityLabel={`${item.readAt ? '' : '未読、'}${item.title}、${item.body}`}
          accessibilityState={{ disabled: task.pending }}
          style={({ pressed }) => ({
            flexDirection: 'row',
            padding: theme.spacing.md,
            gap: theme.spacing.sm,
            borderRadius: theme.radius.md,
            backgroundColor: item.readAt
              ? theme.colors.surface
              : theme.colors.surfaceSubtle,
            opacity: pressed || task.pending ? theme.opacity.pressed : 1,
          })}
        >
          <View style={{ paddingTop: theme.spacing.xxs }}>
            <Icon
              name={
                item.target.type === 'photo' || item.target.type === 'stamp'
                  ? 'image-multiple-outline'
                  : 'bag-suitcase-outline'
              }
              tone="primary"
            />
          </View>
          <View style={{ flex: 1, gap: theme.spacing.xs }}>
            <AppText variant="label">{item.title}</AppText>
            <AppText variant="caption" tone="textSecondary">
              {item.body}
            </AppText>
            <AppText variant="caption" tone="textMuted">
              {timestampLabel(item.createdAt)}
            </AppText>
          </View>
          {!item.readAt ? (
            <View style={{ paddingTop: theme.spacing.xs }}>
              <UnreadBadge label="未読のお知らせがあります" />
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}
