import { Pressable } from 'react-native';
import type { ColorToken } from '../theme/tokens';
import type { IconName } from './Icon';
import { Icon } from './Icon';

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'text',
  selected,
  disabled = false,
  className = '',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: ColorToken;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      className={[
        'min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full active:opacity-pressed',
        disabled ? 'opacity-disabled' : '',
        className,
      ].join(' ')}
    >
      <Icon name={icon} tone={tone} />
    </Pressable>
  );
}
