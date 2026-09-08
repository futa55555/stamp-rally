import { ActivityIndicator, Pressable } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import type { ColorToken } from '../theme/tokens';
import { AppText } from './AppText';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function Button({
  label,
  onPress,
  icon,
  variant = 'primary',
  pending = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'secondary' | 'danger';
  pending?: boolean;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const tone: ColorToken =
    variant === 'primary'
      ? 'onPrimary'
      : variant === 'danger'
        ? 'error'
        : 'text';
  const backgrounds = {
    primary: 'bg-primary active:bg-primaryPressed',
    secondary: 'bg-surface border border-border',
    danger: 'bg-errorBackground',
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onPress}
      className={[
        'min-h-[52px] flex-row items-center justify-center gap-3 rounded-2xl px-6 py-3 active:opacity-pressed',
        backgrounds[variant],
        disabled || pending ? 'opacity-disabled' : '',
      ].join(' ')}
    >
      {pending ? (
        <ActivityIndicator color={theme.colors[tone]} />
      ) : icon ? (
        <Icon name={icon} tone={tone} size={21} />
      ) : null}
      <AppText variant="label" tone={tone} className="shrink text-center">
        {label}
      </AppText>
    </Pressable>
  );
}
