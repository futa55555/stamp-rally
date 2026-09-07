import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { photoSource } from '../data/photoSources';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText, Icon, IconButton } from './ui';

export function PhotoImage({
  url,
  ...props
}: {
  url: string | null;
  label?: string;
  fit?: 'cover' | 'contain';
  onDisplayed?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  // Reset loading/error state when a reused list cell changes its image.
  return <ImageContent key={url} url={url} {...props} />;
}

function ImageContent({
  url,
  label,
  fit = 'cover',
  onDisplayed,
  style,
}: Parameters<typeof PhotoImage>[0]) {
  const theme = useAppTheme();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    'loading',
  );
  const [attempt, setAttempt] = useState(0);
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          backgroundColor:
            fit === 'contain'
              ? theme.colors.photoBackground
              : theme.colors.surfaceSubtle,
        },
        style,
      ]}
    >
      {url && status !== 'error' ? (
        <Image
          key={attempt}
          source={photoSource(url)}
          resizeMode={fit}
          accessible={!!label}
          accessibilityLabel={label}
          style={StyleSheet.absoluteFill}
          onLoad={() => {
            setStatus('ready');
            onDisplayed?.();
          }}
          onError={() => setStatus('error')}
        />
      ) : null}
      {!url || status !== 'ready' ? (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              justifyContent: 'center',
              alignItems: 'center',
              padding: theme.spacing.sm,
              gap: theme.spacing.xs,
            },
          ]}
        >
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
