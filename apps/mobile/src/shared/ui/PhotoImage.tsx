import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { photoSource } from '../../../assets/photoSources';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

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
  className?: string;
}) {
  // Reset loading/error state when a reused list cell changes its image.
  return <ImageContent key={url} url={url} {...props} />;
}

function ImageContent({
  url,
  label,
  fit = 'cover',
  background = fit === 'contain' ? 'photoBackground' : 'surfaceSubtle',
  onDisplayed,
  className = '',
}: Parameters<typeof PhotoImage>[0]) {
  const theme = useAppTheme();
  const darkBackground = background === 'photoBackground';
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  return (
    <View
      className={['overflow-hidden', backgrounds[background], className].join(
        ' ',
      )}
    >
      {url && status !== 'error' ? (
        <Image
          key={attempt}
          source={photoSource(url)}
          resizeMode={fit}
          accessible={!!label}
          accessibilityLabel={label}
          className="absolute inset-0 h-full w-full"
          onLoad={() => {
            setStatus('ready');
            onDisplayed?.();
          }}
          onError={() => setStatus('error')}
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
                  setStatus('loading');
                  setAttempt((n) => n + 1);
                }}
              />
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}
