import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '../../data/AppDataProvider';
import { isUnreadPhoto } from '../../data/selectors';
import { timestampLabel } from '../../data/dates';
import { useAppTheme } from '../../theme/ThemeProvider';
import { usePhoto, useTask } from '../hooks';
import {
  AppText,
  Button,
  ErrorMessage,
  Icon,
  StateView,
} from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';

export function PhotoDetailScreen() {
  const router = useRouter();
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const theme = useAppTheme();
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
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: theme.spacing.lg,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
      }}
    >
      <PhotoImage
        url={photo.mediaUrl}
        label={`${photo.author.name ?? '旅の仲間'}が投稿した${stamp?.name ?? '旅'}の写真`}
        fit="contain"
        onDisplayed={() => setDisplayedId(photo.id)}
        style={{ width: '100%', aspectRatio: 0.9, minHeight: 260 }}
      />
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.sm,
          }}
        >
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: theme.radius.pill,
              backgroundColor: theme.colors.surfaceSubtle,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name="account-outline" tone="primary" />
          </View>
          <View style={{ flex: 1 }}>
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
