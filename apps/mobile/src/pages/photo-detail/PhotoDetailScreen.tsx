import {
  useIsFocused,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../../features/app-data/AppDataProvider';
import { usePhoto } from '../../features/photos/hooks/usePhoto';
import {
  savePhotoToLibrary,
  sharePhoto,
  type OriginalMedia,
} from '../../features/photos/lib/photoTransfer';
import { QueryState } from '../../shared/ui/QueryState';
import type { TripStackParamList } from '../../features/trips/navigation/types';
import { useTask } from '../../shared/hooks/useTask';
import { PageHeader } from '../../shared/ui/Header';
import { IconButton } from '../../shared/ui/IconButton';
import { StateView } from '../../shared/ui/StateView';
import { PhotoGallery } from './components/PhotoGallery';

type PhotoDetailParams = TripStackParamList['photo/[postId]'];

export function PhotoDetailScreen() {
  const params = useLocalSearchParams<PhotoDetailParams>();
  return <PhotoDetail key={`${params.postId}:${params.source}`} {...params} />;
}

function PhotoDetail({ postId, source, ...origin }: PhotoDetailParams) {
  const router = useRouter();
  const navigation = useNavigation();
  const isFocused = useIsFocused();
  const { userId, actions, client } = useData();
  const [activeId, setActiveId] = useState(postId);
  const query = usePhoto(activeId);
  const { photo, stamp, trip } = query;
  const [displayedIds, setDisplayedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [readAttempt, setReadAttempt] = useState(0);
  const task = useTask();
  const tripId = origin.tripId ?? photo?.tripId;
  const stampId = origin.stampId ?? stamp?.id;
  const title =
    source === 'trip' ? (trip?.name ?? '旅行') : (stamp?.name ?? 'スタンプ');
  // Notifications without a source use the stamp gallery and its parent stack.
  const photos = !photo ? [] : source === 'trip' ? [photo] : query.photos;
  const displayed = displayedIds.has(activeId);
  const mediaLabel = photo?.mediaType === 'VIDEO' ? '動画' : '写真';
  const original = async (id: string) => {
    const guard = client.sessionGuard();
    const result = await client.request<OriginalMedia>({
      url: `/posts/${id}/original`,
    });
    guard();
    return result;
  };
  const unread =
    !!photo && !!userId && photo.author.id !== userId && !photo.readAt;

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else if (source === 'trip' && tripId)
      router.replace({ pathname: '/trips/trip/[tripId]', params: { tripId } });
    else if (stampId)
      router.replace({
        pathname: '/trips/stamp/[stampId]',
        params: { stampId, viaGenreId: origin.viaGenreId },
      });
    else router.replace('/trips');
  };

  useEffect(() => {
    if (!isFocused || !displayed || !unread || !userId) return;
    let current = true;
    void actions.markPhotoRead(userId, activeId).catch(() => {
      if (current)
        Alert.alert('既読を更新できませんでした', 'もう一度お試しください。', [
          { text: '閉じる', style: 'cancel' },
          {
            text: '再試行',
            onPress: () => setReadAttempt((attempt) => attempt + 1),
          },
        ]);
    });
    return () => {
      current = false;
    };
  }, [isFocused, displayed, unread, userId, activeId, actions, readAttempt]);

  useEffect(() => {
    if (isFocused && task.error)
      Alert.alert('操作できませんでした', task.error);
  }, [isFocused, task.error]);

  return (
    <View className="flex-1 bg-background">
      <PageHeader title={mediaLabel} backTitle={title} onBack={goBack} />
      <SafeAreaView edges={['left', 'right']} className="flex-1">
        {query.isPending || (query.error && !task.pending) ? (
          <QueryState query={query} />
        ) : photo ? (
          <PhotoGallery
            photos={photos}
            focused={isFocused}
            activeId={activeId}
            stampName={stamp?.name ?? '旅'}
            scrollEnabled={source !== 'trip' && !task.pending}
            onActiveChange={setActiveId}
            onDisplayed={(id) =>
              setDisplayedIds((ids) =>
                ids.has(id) ? ids : new Set([...ids, id]),
              )
            }
          />
        ) : !task.pending ? (
          <StateView
            title="投稿が見つかりません"
            description="一覧から選び直してください。"
            action={{ label: '戻る', onPress: goBack }}
          />
        ) : null}
      </SafeAreaView>
      <SafeAreaView
        edges={['bottom', 'left', 'right']}
        className="bg-background"
      >
        <View className="flex-row items-center justify-around border-t border-border px-4 py-2">
          <IconButton
            icon="share-variant-outline"
            label={`${mediaLabel}を共有`}
            disabled={!photo || task.pending}
            onPress={() => {
              if (photo)
                void task.run(async () => sharePhoto(await original(photo.id)));
            }}
          />
          <IconButton
            icon={photo?.isFavorite ? 'heart' : 'heart-outline'}
            label={photo?.isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
            selected={photo?.isFavorite ?? false}
            tone={photo?.isFavorite ? 'favorite' : 'text'}
            disabled={!photo || task.pending}
            onPress={() => {
              if (photo)
                void task.run(() =>
                  actions.setFavorite(photo.id, !photo.isFavorite),
                );
            }}
          />
          <IconButton
            icon="download-outline"
            label={`${mediaLabel}をダウンロード`}
            disabled={!photo || task.pending}
            onPress={() => {
              if (!photo) return;
              void task
                .run(async () => savePhotoToLibrary(await original(photo.id)))
                .then((saved) => {
                  if (saved && navigation.isFocused())
                    Alert.alert(`${mediaLabel}を保存しました`);
                });
            }}
          />
          <IconButton
            icon="trash-can-outline"
            label={`${mediaLabel}を削除`}
            tone="error"
            disabled={!photo || !userId || task.pending}
            onPress={() => {
              if (!photo || !userId) return;
              Alert.alert(
                `この${mediaLabel}を削除しますか？`,
                '旅行の仲間の一覧とお気に入りからも削除されます。',
                [
                  { text: 'キャンセル', style: 'cancel' },
                  {
                    text: '削除',
                    style: 'destructive',
                    onPress: () => {
                      void task
                        .run(() => actions.deletePost(userId, photo.id))
                        .then((deleted) => {
                          if (deleted && navigation.isFocused()) goBack();
                        });
                    },
                  },
                ],
              );
            }}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
