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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || pending, busy: pending }}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: theme.layout.touchTarget + 4,
        paddingHorizontal: theme.spacing.lg,
        paddingVertical: theme.spacing.sm,
        borderRadius: theme.radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing.sm,
        backgroundColor:
          variant === 'primary'
            ? pressed
              ? theme.colors.primaryPressed
              : theme.colors.primary
            : variant === 'danger'
              ? theme.colors.errorBackground
              : theme.colors.surface,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: theme.colors.border,
        opacity:
          disabled || pending
            ? theme.opacity.disabled
            : pressed
              ? theme.opacity.pressed
              : 1,
      })}
    >
      {pending ? (
        <ActivityIndicator color={theme.colors[tone]} />
      ) : icon ? (
        <Icon name={icon} tone={tone} size={21} />
      ) : null}
      <AppText variant="label" tone={tone}>
        {label}
      </AppText>
    </Pressable>
  );
}
