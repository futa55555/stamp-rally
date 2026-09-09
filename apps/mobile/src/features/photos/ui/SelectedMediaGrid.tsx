import { Image, type ImageProps } from 'expo-image';
import {
  createVideoPlayer,
  type VideoPlayer,
  type VideoThumbnail,
} from 'expo-video';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Icon } from '../../../shared/ui/Icon';
import type { PickedMedia } from '../model/inputs';

export function SelectedMediaGrid({ files }: { files: PickedMedia[] }) {
  return (
    <View className="-m-1 flex-row flex-wrap">
      {files.map((file, index) => (
        <View key={file.clientId} className="w-1/4 p-1">
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={`${index + 1}件目の${file.mediaType === 'VIDEO' ? '動画' : '写真'}: ${file.fileName}`}
            className="aspect-square items-center justify-center overflow-hidden rounded-lg bg-surfaceSubtle"
          >
            <Icon
              name={
                file.mediaType === 'VIDEO' ? 'video-outline' : 'image-outline'
              }
              tone="textMuted"
            />
            {file.mediaType === 'VIDEO' ? (
              <VideoPreview key={file.uri} uri={file.uri} />
            ) : (
              <PreviewImage key={file.uri} source={{ uri: file.uri }} />
            )}
            {file.mediaType === 'VIDEO' ? (
              <View className="absolute bottom-1 right-1 rounded bg-photoBackground p-1">
                <Icon name="play" tone="onPhoto" size={14} />
              </View>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function PreviewImage({ source }: { source: ImageProps['source'] }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <Image
      source={source}
      contentFit="cover"
      cachePolicy="memory"
      accessible={false}
      style={{ position: 'absolute', width: '100%', height: '100%' }}
      onError={() => setFailed(true)}
    />
  );
}

function VideoPreview({ uri }: { uri: string }) {
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  useEffect(() => {
    let active = true;
    let player: VideoPlayer | undefined;
    let image: VideoThumbnail | undefined;
    const releasePlayer = () => {
      player?.release();
      player = undefined;
    };
    const load = async () => {
      try {
        player = createVideoPlayer(null);
        await player.replaceAsync(uri);
        if (!active) return;
        const [generated] = await player.generateThumbnailsAsync([0], {
          maxWidth: 256,
          maxHeight: 256,
        });
        if (!active) {
          generated?.release();
          return;
        }
        image = generated;
        setThumbnail(generated ?? null);
      } catch {
        // Keep the video icon if this device cannot decode the preview.
      } finally {
        releasePlayer();
      }
    };
    void load();
    return () => {
      active = false;
      releasePlayer();
      image?.release();
    };
  }, [uri]);
  return thumbnail ? <PreviewImage source={thumbnail} /> : null;
}
