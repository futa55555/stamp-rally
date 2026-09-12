import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import type { useCategory } from '../../../features/trips/hooks';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import { PostImage } from '../../../features/photos/ui/PostImage';
import type { Post } from '../../../features/photos/model/types';
import { UnreadBadge } from '../../../shared/ui/UnreadBadge';
export function StampCard({
  stamp,
  photo,
  categoryId,
}: {
  stamp: ReturnType<typeof useCategory>['stamps'][number];
  photo?: Post;
  categoryId: string;
}) {
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        stamp.name +
        (stamp.unread ? '、未読あり' : '') +
        '、' +
        ((stamp.mediaCount ?? stamp.photoCount)
          ? `${stamp.photoCount}枚${stamp.videoCount ? `・動画${stamp.videoCount}本` : ''}投稿済み`
          : 'まだ投稿がありません')
      }
      onPress={() =>
        router.push({
          pathname: '/trips/stamp/[stampId]',
          params: { stampId: stamp.id, viaCategoryId: categoryId },
        })
      }
      className="min-w-0 flex-1 gap-2 active:opacity-pressed"
    >
      {photo ? (
        <PostImage
          post={photo}
          fit="cover"
          className="aspect-square rounded-2xl"
        />
      ) : (
        <View className="aspect-square items-center justify-center rounded-2xl bg-border">
          <Icon name="camera-outline" size={32} tone="textMuted" />
        </View>
      )}
      <View className="flex-row items-center gap-2">
        <AppText
          variant="label"
          className="min-w-0 flex-1"
          numberOfLines={1}
          ellipsizeMode="tail"
          accessibilityLabel={stamp.name}
        >
          {stamp.name}
        </AppText>
        <View className="w-2 shrink-0">
          {stamp.unread ? <UnreadBadge /> : null}
        </View>
        <Icon name="chevron-right" size={20} tone="textMuted" />
      </View>
      <AppText variant="caption" tone="textSecondary">
        {(stamp.mediaCount ?? stamp.photoCount)
          ? `${stamp.photoCount}枚${stamp.videoCount ? `・動画${stamp.videoCount}本` : ''}投稿済み`
          : 'まだ投稿がありません'}
      </AppText>
    </Pressable>
  );
}
