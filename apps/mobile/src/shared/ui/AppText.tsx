import type { TextProps } from 'react-native';
import { Text, useWindowDimensions } from 'react-native';
import type { AppTheme, ColorToken } from '../theme/tokens';

const variants = {
  hero: 'text-hero',
  title: 'text-title',
  heading: 'text-heading',
  body: 'text-body',
  label: 'text-label',
  caption: 'text-caption',
  eyebrow: 'text-eyebrow',
};
const tones: Record<ColorToken, string> = {
  background: 'text-background',
  surface: 'text-surface',
  surfaceSubtle: 'text-surfaceSubtle',
  text: 'text-text',
  textSecondary: 'text-textSecondary',
  textMuted: 'text-textMuted',
  border: 'text-border',
  primary: 'text-primary',
  primaryPressed: 'text-primaryPressed',
  onPrimary: 'text-onPrimary',
  active: 'text-active',
  activeBackground: 'text-activeBackground',
  favorite: 'text-favorite',
  favoriteBackground: 'text-favoriteBackground',
  unread: 'text-unread',
  onUnread: 'text-onUnread',
  error: 'text-error',
  errorBackground: 'text-errorBackground',
  photoBackground: 'text-photoBackground',
  onPhoto: 'text-onPhoto',
  overlay: 'text-overlay',
  transparent: 'text-transparent',
};
export function AppText({
  variant = 'body',
  tone = 'text',
  className = '',
  ...props
}: TextProps & { variant?: keyof AppTheme['typography']; tone?: ColorToken }) {
  const { fontScale } = useWindowDimensions();
  return (
    <Text
      // Remeasure native text when Dynamic Type changes while the app is open.
      key={fontScale}
      allowFontScaling
      {...props}
      className={[variants[variant], tones[tone], className].join(' ')}
    />
  );
}
