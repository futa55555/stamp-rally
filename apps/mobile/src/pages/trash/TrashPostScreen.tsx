import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../../features/app-data/AppDataProvider';
import { useDetail } from '../../features/app-data/api/queries';
import { PostImage } from '../../features/photos/ui/PostImage';
import { restoreDeadline, type TrashedPost } from '../../features/trash/types';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { QueryState } from '../../shared/ui/QueryState';
import { PostVideo } from '../photo-detail/components/PostVideo';

export function TrashPostScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const router = useRouter();
  const focused = useIsFocused();
  const { userId, actions } = useData();
  const resourcePath = `/posts/trash/${postId}`;
  const query = useDetail<TrashedPost>(resourcePath, !!postId);
  const task = useTask();
  const post = query.data;
  if (!post || (query.error && !task.pending))
    return <QueryState query={query} />;
  const expired = new Date(post.expiresAt).getTime() <= Date.now();
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      className="flex-1 bg-background"
    >
      <View className="px-4 py-3 gap-1">
        <AppText variant="heading">{post.trip.name}</AppText>
        <AppText variant="caption" tone="textSecondary">
          {post.trip.startDate} 〜 {post.trip.endDate}
        </AppText>
        <AppText>{post.stampName}</AppText>
      </View>
      <View className="flex-1 min-h-48">
        {post.mediaType === 'VIDEO' && focused ? (
          <PostVideo
            post={post}
            resourcePath={resourcePath}
            onDisplayed={() => {}}
          />
        ) : (
          <PostImage
            post={post}
            resourcePath={resourcePath}
            variant="large"
            fit="contain"
            className="flex-1"
          />
        )}
      </View>
      <View className="px-4 py-4 gap-3">
        <AppText variant="caption" tone="textSecondary">
          {restoreDeadline(post.expiresAt)}
          まで復元できます。元のスタンプに戻ります。
        </AppText>
        <ErrorMessage message={task.error} />
        <Button
          label={expired ? '復元期限を過ぎています' : '復元する'}
          pending={task.pending}
          disabled={expired || !userId}
          onPress={() => {
            if (!userId) return;
            void task
              .run(() => actions.restorePost(userId, post.id))
              .then((restored) => {
                if (restored) {
                  if (router.canGoBack()) router.back();
                  else router.replace('/settings/trash');
                }
              });
          }}
        />
      </View>
    </SafeAreaView>
  );
}
