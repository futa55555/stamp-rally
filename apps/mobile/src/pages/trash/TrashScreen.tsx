import { useRouter } from 'expo-router';
import { Pressable, SectionList, View } from 'react-native';
import { useList } from '../../features/app-data/api/queries';
import { PostImage } from '../../features/photos/ui/PostImage';
import {
  groupTrashByTrip,
  restoreDeadline,
  type TrashedPost,
} from '../../features/trash/types';
import { usePullToRefresh } from '../../shared/hooks/usePullToRefresh';
import { AppText } from '../../shared/ui/AppText';
import { QueryState } from '../../shared/ui/QueryState';
import { StateView } from '../../shared/ui/StateView';

export function TrashScreen() {
  const router = useRouter();
  const query = useList<TrashedPost>('/posts/trash', {});
  const refresh = usePullToRefresh(query.invalidate);
  if (query.isPending || query.error) return <QueryState query={query} />;
  return (
    <SectionList
      className="flex-1 bg-background"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: 32 }}
      sections={groupTrashByTrip(query.data ?? [])}
      keyExtractor={(post) => post.id}
      stickySectionHeadersEnabled
      {...refresh}
      ListHeaderComponent={
        <AppText variant="caption" tone="textSecondary" className="px-4 py-4">
          削除した写真・動画は30日間復元できます。旅行・カテゴリー・スタンプを削除すると、関連する投稿も復元できなくなります。
        </AppText>
      }
      ListEmptyComponent={
        <StateView
          title="ゴミ箱は空です"
          description="削除した写真・動画が旅行ごとに表示されます。"
          icon="trash-can-outline"
        />
      }
      renderSectionHeader={({ section }) => (
        <View className="bg-background px-4 py-3 border-b border-border">
          <AppText variant="heading" accessibilityRole="header">
            {section.trip.name}
          </AppText>
          <AppText variant="caption" tone="textSecondary">
            {section.trip.startDate} 〜 {section.trip.endDate}
          </AppText>
        </View>
      )}
      renderItem={({ item: post }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${post.stampName}の${post.mediaType === 'VIDEO' ? '動画' : '写真'}を表示して復元`}
          className="flex-row items-center gap-4 px-4 py-3 active:opacity-pressed"
          onPress={() =>
            router.push({
              pathname: '/settings/trash/[postId]',
              params: { postId: post.id },
            })
          }
        >
          <PostImage
            post={post}
            resourcePath={`/posts/trash/${post.id}`}
            className="w-24 h-24 rounded-xl"
          />
          <View className="flex-1 gap-1">
            <AppText variant="label">{post.stampName}</AppText>
            <AppText variant="caption" tone="textSecondary">
              {post.mediaType === 'VIDEO' ? '動画' : '写真'} ·{' '}
              {post.author.name ?? '旅の仲間'}
            </AppText>
            <AppText variant="caption" tone="textSecondary">
              {restoreDeadline(post.expiresAt)}まで復元可能
            </AppText>
            <AppText variant="caption" tone="primary">
              表示して復元
            </AppText>
          </View>
        </Pressable>
      )}
    />
  );
}
