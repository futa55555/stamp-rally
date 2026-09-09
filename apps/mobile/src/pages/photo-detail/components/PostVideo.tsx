import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useData } from '../../../features/app-data/AppDataProvider';
import type { Post } from '../../../features/photos/model/types';
import { PostImage } from '../../../features/photos/ui/PostImage';
import { IconButton } from '../../../shared/ui/IconButton';
import { AppText } from '../../../shared/ui/AppText';

export function PostVideo({
  post,
  onDisplayed,
}: {
  post: Post;
  onDisplayed: () => void;
}) {
  const { client } = useData();
  const [url, setUrl] = useState(post.playbackUrl ?? null);
  const [started, setStarted] = useState(false);
  const [firstFrame, setFirstFrame] = useState(false);
  const [refreshed, setRefreshed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const player = useVideoPlayer(url, (instance) => {
    instance.loop = false;
  });
  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const refresh = async () => {
    try {
      const current = client.sessionGuard();
      const fresh = await client.request<Post>({ url: `/posts/${post.id}` });
      current();
      if (!fresh.playbackUrl) throw new Error('再生用データが見つかりません。');
      setFirstFrame(false);
      setStarted(false);
      setError(null);
      setUrl(fresh.playbackUrl);
      await player.replaceAsync(fresh.playbackUrl);
    } catch {
      setError('動画を読み込めませんでした。');
    }
  };
  useEffect(() => {
    if (isPlaying && firstFrame) onDisplayed();
  }, [isPlaying, firstFrame, onDisplayed]);
  useEffect(() => {
    if (status !== 'error') return;
    if (!refreshed) {
      setRefreshed(true);
      void refresh();
    } else setError('動画を読み込めませんでした。');
  }, [status]);
  return (
    <View className="flex-1 bg-photoBackground">
      <VideoView
        player={player}
        style={{ flex: 1 }}
        contentFit="contain"
        nativeControls
        onFirstFrameRender={() => setFirstFrame(true)}
      />
      {!started || !firstFrame || error ? (
        <View className="absolute inset-0">
          <PostImage
            post={post}
            variant="large"
            fit="contain"
            className="flex-1"
          />
          <View className="absolute inset-0 items-center justify-center">
            {error || !url ? (
              <>
                <AppText tone="onPhoto">
                  {error ?? '再生用データが見つかりません'}
                </AppText>
                <IconButton
                  icon="reload"
                  label="動画を再読み込み"
                  tone="onPhoto"
                  onPress={() => {
                    void refresh();
                  }}
                />
              </>
            ) : (
              <IconButton
                icon="play-circle"
                label="動画を再生"
                tone="onPhoto"
                onPress={() => {
                  setStarted(true);
                  player.play();
                }}
              />
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}
