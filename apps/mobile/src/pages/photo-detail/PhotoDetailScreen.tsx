import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { usePhoto } from '../../features/photos/hooks/usePhoto';
import { isUnreadPhoto } from '../../features/photos/model/selectors';
import { useTask } from '../../shared/hooks/useTask';
import { timestampLabel } from '../../shared/lib/dates';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { Icon } from '../../shared/ui/Icon';
import { PhotoImage } from '../../shared/ui/PhotoImage';
import { StateView } from '../../shared/ui/StateView';

export function PhotoDetailScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { photo, stamp } = usePhoto(postId);
  const { data, userId, actions } = useData();
  const favoriteTask = useTask();
  const readTask = useTask();
  const isFocused = useIsFocused();
  const [displayedId, setDisplayedId] = useState<string | null>(null);
  const unread = !!photo && !!userId && isUnreadPhoto(data, userId, photo);
  const readPhoto = readTask.run;
  useEffect(() => {
    if (isFocused && displayedId === postId && unread && userId) {
      void readPhoto(() => actions.markPhotoRead(userId, postId));
    }
  }, [isFocused, displayedId, postId, unread, userId, actions, readPhoto]);
  if (!photo)
    return (
      <StateView
        title="写真が見つかりません"
        description="写真一覧から選び直してください。"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow pb-6 w-full max-w-page self-center"
    >
      <PhotoImage
        url={photo.mediaUrl}
        label={`${photo.author.name ?? '旅の仲間'}が投稿した${stamp?.name ?? '旅'}の写真`}
        fit="contain"
        onDisplayed={() => setDisplayedId(photo.id)}
        className="w-full aspect-[0.9] min-h-[260px]"
      />
      <View className="p-6 gap-4">
        <View className="flex-row items-center gap-3">
          <View className="w-[42px] h-[42px] rounded-full bg-surfaceSubtle items-center justify-center">
            <Icon name="account-outline" tone="primary" />
          </View>
          <View className="flex-1">
            <AppText variant="label">{photo.author.name ?? '旅の仲間'}</AppText>
            <AppText variant="caption" tone="textSecondary">
              {timestampLabel(photo.createdAt)}
            </AppText>
          </View>
        </View>
        <AppText variant="heading">{stamp?.name}</AppText>
        <Button
          label={photo.isFavorite ? 'お気に入りに登録済み' : 'お気に入りに追加'}
          icon={photo.isFavorite ? 'star' : 'star-outline'}
          variant="secondary"
          pending={favoriteTask.pending}
          onPress={() => {
            void favoriteTask.run(() =>
              actions.setFavorite(photo.id, !photo.isFavorite),
            );
          }}
        />
        <AppText variant="caption" tone="textMuted">
          お気に入りは、旅の仲間みんなで共有されます。
        </AppText>
        <ErrorMessage message={favoriteTask.error} />
        <ErrorMessage message={readTask.error} />
        {readTask.error && userId ? (
          <Button
            label="既読の更新を再試行"
            variant="secondary"
            pending={readTask.pending}
            onPress={() => {
              void readTask.run(() => actions.markPhotoRead(userId, photo.id));
            }}
          />
        ) : null}
      </View>
    </ScrollView>
  );
}
