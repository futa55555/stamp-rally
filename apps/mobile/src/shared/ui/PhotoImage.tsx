import { useRef, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Image } from 'expo-image';
import { photoSource } from '../../../assets/photoSources';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';
import { imageCacheKey } from '../lib/imageCacheKey';

const backgrounds = {
  background: 'bg-background',
  surfaceSubtle: 'bg-surfaceSubtle',
  photoBackground: 'bg-photoBackground',
};

export function PhotoImage({
  url,
  ...props
}: {
  url: string | null;
  label?: string;
  fit?: 'cover' | 'contain';
  background?: keyof typeof backgrounds;
  onDisplayed?: () => void;
  blurhash?: string | null;
  blurhashSizing?: 'image' | 'container';
  imageWidth?: number | null;
  imageHeight?: number | null;
  refresh?: () => Promise<string | null>;
  className?: string;
}) {
  // Reset a recycled cell for a different image, not for renewed authorization.
  return (
    <ImageContent
      key={url ? imageCacheKey(url) : 'empty'}
      url={url}
      {...props}
    />
  );
}

function ImageContent({
  url,
  label,
  fit = 'cover',
  background = fit === 'contain' ? 'photoBackground' : 'surfaceSubtle',
  onDisplayed,
  blurhash,
  blurhashSizing = 'image',
  imageWidth,
  imageHeight,
  refresh,
  className = '',
}: Parameters<typeof PhotoImage>[0]) {
  const theme = useAppTheme();
  const darkBackground = background === 'photoBackground';
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  // Keep the displayed source while this image's identity is unchanged. If it
  // fails, retry with the latest signed URL received through props.
  const [sourceUrl, setSourceUrl] = useState(url);
  const lastAttemptedUrl = useRef(url);
  const [refreshed, setRefreshed] = useState(false);
  const reload = async () => {
    setStatus('loading');
    try {
      const hasNewUrl =
        url && url !== lastAttemptedUrl.current && url !== sourceUrl;
      lastAttemptedUrl.current = url;
      if (hasNewUrl) {
        setSourceUrl(url);
      } else if (refresh) {
        const fresh = await refresh();
        if (!fresh) throw new Error('表示用画像が見つかりません。');
        setSourceUrl(fresh);
      }
      setAttempt((n) => n + 1);
    } catch {
      setStatus('error');
    }
  };
  const source = sourceUrl ? photoSource(sourceUrl) : undefined;
  const placeholder = blurhashPlaceholder(
    blurhash,
    blurhashSizing === 'container' ? containerSize.width : imageWidth,
    blurhashSizing === 'container' ? containerSize.height : imageHeight,
  );
  return (
    <View
      className={['overflow-hidden', backgrounds[background], className].join(
        ' ',
      )}
      onLayout={
        blurhashSizing === 'container'
          ? ({ nativeEvent: { layout } }) =>
              setContainerSize((previous) =>
                previous.width === layout.width &&
                previous.height === layout.height
                  ? previous
                  : { width: layout.width, height: layout.height },
              )
          : undefined
      }
    >
      {sourceUrl && status !== 'error' ? (
        <Image
          key={attempt}
          source={
            typeof source === 'number'
              ? source
              : {
                  uri: sourceUrl,
                  cacheKey: imageCacheKey(sourceUrl),
                }
          }
          contentFit={fit}
          placeholder={placeholder}
          placeholderContentFit={fit}
          cachePolicy="memory-disk"
          accessible={!!label}
          accessibilityLabel={label}
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }}
          onDisplay={() => {
            setStatus('ready');
            onDisplayed?.();
          }}
          onError={() => {
            if ((refresh || url !== lastAttemptedUrl.current) && !refreshed) {
              setRefreshed(true);
              void reload();
            } else setStatus('error');
          }}
        />
      ) : null}
      {!url || status !== 'ready' ? (
        <View className="absolute inset-0 items-center justify-center gap-2 p-3">
          {!url ? (
            <Icon name="image-outline" tone="textMuted" size={32} />
          ) : status === 'loading' ? (
            <ActivityIndicator
              color={
                darkBackground ? theme.colors.onPhoto : theme.colors.primary
              }
            />
          ) : (
            <>
              <Icon
                name="image-broken-variant"
                tone={darkBackground ? 'onPhoto' : 'textMuted'}
              />
              <AppText
                variant="caption"
                tone={darkBackground ? 'onPhoto' : 'textSecondary'}
              >
                写真を読み込めませんでした
              </AppText>
              <IconButton
                icon="reload"
                label="写真を再読み込み"
                tone={darkBackground ? 'onPhoto' : 'primary'}
                onPress={() => {
                  void reload();
                }}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function blurhashPlaceholder(
  blurhash?: string | null,
  imageWidth?: number | null,
  imageHeight?: number | null,
) {
  // Wait for dimensions rather than displaying a square placeholder first.
  if (
    !blurhash ||
    !imageWidth ||
    !imageHeight ||
    imageWidth <= 0 ||
    imageHeight <= 0 ||
    !Number.isFinite(imageWidth) ||
    !Number.isFinite(imageHeight)
  )
    return undefined;
  // BlurHash has no intrinsic aspect ratio. Decode a small bitmap using the
  // supplied proportions; full image dimensions would make decoding expensive.
  const longestSide = Math.max(imageWidth, imageHeight);
  const width = Math.max(1, Math.round((imageWidth / longestSide) * 32));
  const height = Math.max(1, Math.round((imageHeight / longestSide) * 32));
  return {
    blurhash,
    width,
    height,
    // iOS caches decoded placeholders by URI, which contains only the hash.
    // Include dimensions so an older square decode cannot be reused.
    cacheKey: `blurhash:${blurhash}:${width}x${height}`,
  };
}
