import { useState } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { photoSource } from '../../../assets/photoSources';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { IconButton } from './IconButton';

export function PhotoImage({
  url,
  ...props
}: {
  url: string | null;
  label?: string;
  fit?: 'cover' | 'contain';
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
  onDisplayed,
  className = '',
}: Parameters<typeof PhotoImage>[0]) {
  const theme = useAppTheme();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  return (
    <View
      className={[
        'overflow-hidden',
        fit === 'contain' ? 'bg-photoBackground' : 'bg-surfaceSubtle',
        className,
      ].join(' ')}
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
                fit === 'contain' ? theme.colors.onPhoto : theme.colors.primary
              }
            />
          ) : (
            <>
              <Icon
                name="image-broken-variant"
                tone={fit === 'contain' ? 'onPhoto' : 'textMuted'}
              />
              <AppText
                variant="caption"
                tone={fit === 'contain' ? 'onPhoto' : 'textSecondary'}
              >
                写真を読み込めませんでした
              </AppText>
              <IconButton
                icon="reload"
                label="写真を再読み込み"
                tone={fit === 'contain' ? 'onPhoto' : 'primary'}
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
