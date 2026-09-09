import { useNavigation } from 'expo-router';
import { FlatList, Pressable, View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { useNotifications } from '../../features/notifications/hooks';
import type { AppNotification } from '../../features/notifications/model/types';
import { resolveApiTarget } from '../../features/trips/navigation/targets';
import { QueryState } from '../../shared/ui/QueryState';
import { Button } from '../../shared/ui/Button';
import { useTask } from '../../shared/hooks/useTask';
import { timestampLabel } from '../../shared/lib/dates';
import { AppText } from '../../shared/ui/AppText';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { StateView } from '../../shared/ui/StateView';
import { UnreadBadge } from '../../shared/ui/UnreadBadge';

export function NotificationsScreen() {
  const navigation = useNavigation();
  const query = useNotifications();
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
  return (
    <FlatList
      data={notifications}
      refreshing={query.isRefetching}
      onRefresh={() => {
        void query.refetch();
      }}
      ListFooterComponent={
        query.hasNextPage ? (
          <Button
            label="さらに読み込む"
            pending={query.isFetchingNextPage}
            onPress={() => {
              void query.fetchNextPage();
            }}
          />
        ) : null
      }
      keyExtractor={(notification) => notification.id}
      className="flex-1 bg-background"
      contentContainerClassName="grow px-4 pt-6 pb-12 gap-3 w-full max-w-page self-center"
      ListHeaderComponent={
        <ErrorMessage message={task.error ?? query.error?.message ?? null} />
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
          className={[
            'flex-row p-4 gap-3 rounded-2xl active:opacity-pressed',
            item.readAt ? 'bg-surface' : 'bg-surfaceSubtle',
            task.pending ? 'opacity-pressed' : '',
          ].join(' ')}
        >
          <View className="pt-1">
            <Icon
              name={
                item.target.type === 'photo' || item.target.type === 'stamp'
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
