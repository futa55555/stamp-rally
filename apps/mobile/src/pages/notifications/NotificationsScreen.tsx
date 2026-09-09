import { useNavigation } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { useNotifications } from '../../features/notifications/hooks';
import type { AppNotification } from '../../features/notifications/model/types';
import { resolveApiTarget } from '../../features/trips/navigation/targets';
import { QueryState } from '../../shared/ui/QueryState';
import { Button } from '../../shared/ui/Button';
import { useTask } from '../../shared/hooks/useTask';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { timestampLabel } from '../../shared/lib/dates';
import { AppText } from '../../shared/ui/AppText';
import { EmptyState } from '../../shared/ui/EmptyState';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { ListScreen } from '../../shared/ui/ListScreen';
import { UnreadBadge } from '../../shared/ui/UnreadBadge';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const query = useNotifications();
  const refresh = usePullToRefresh(query.invalidate);
  const { notifications } = query;
  const { client, userId, actions } = useData();
  const task = useTask();
  const openNotification = (notification: AppNotification) =>
    task.run(async () => {
      const assertCurrent = client.sessionGuard();
      const routes = await resolveApiTarget(client, notification.target);
      if (!routes)
        throw new Error(
          '通知の対象が見つかりません。すでに削除されたか、アクセスできない可能性があります。',
        );
      assertCurrent();
      await actions.markNotificationRead(notification.id);
      assertCurrent();
      if (client.snapshot().user?.id !== userId) return;
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
  if (query.isPending || (query.error && !query.data))
    return <QueryState query={query} />;
  const errorMessage = task.error ?? query.error?.message ?? null;
  const loadMore = query.hasNextPage ? (
    <Button
      label="さらに読み込む"
      pending={query.isFetchingNextPage}
      onPress={() => {
        void query.fetchNextPage();
      }}
    />
  ) : null;
  return (
    <ListScreen
      data={notifications}
      {...refresh}
      ListFooterComponent={loadMore}
      keyExtractor={(notification) => notification.id}
      ListHeaderComponent={
        errorMessage ? <ErrorMessage message={errorMessage} /> : null
      }
      ListEmptyComponent={
        <EmptyState
          title="お知らせはまだありません"
          description="旅の更新や仲間の投稿など、新しいお知らせがここに届きます。"
          icon="bell-outline"
          accentIcon="check"
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
          className={[
            'flex-row p-4 gap-3 rounded-2xl active:opacity-pressed',
            item.readAt ? 'bg-surface' : 'bg-surfaceSubtle',
            task.pending ? 'opacity-pressed' : '',
          ].join(' ')}
        >
          <View className="pt-1">
            <Icon
              name={
                item.target.type === 'video'
                  ? 'video-outline'
                  : item.target.type === 'photo' || item.target.type === 'stamp'
                    ? 'image-multiple-outline'
                    : 'bag-suitcase-outline'
              }
              tone="primary"
            />
          </View>
          <View className="flex-1 gap-2">
            <AppText variant="label">{item.title}</AppText>
            <AppText variant="caption" tone="textSecondary">
              {item.body}
            </AppText>
            <AppText variant="caption" tone="textMuted">
              {timestampLabel(item.createdAt)}
            </AppText>
          </View>
          {!item.readAt ? (
            <View className="pt-2">
              <UnreadBadge label="未読のお知らせがあります" />
            </View>
          ) : null}
        </Pressable>
      )}
    />
  );
}
