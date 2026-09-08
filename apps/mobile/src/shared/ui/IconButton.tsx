import { Pressable } from 'react-native';
import type { ColorToken } from '../theme/tokens';
import type { IconName } from './Icon';
import { Icon } from './Icon';

const alignments = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
};

export function IconButton({
  icon,
  label,
  onPress,
  tone = 'text',
  selected,
  disabled = false,
  align = 'center',
  className = '',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: ColorToken;
  selected?: boolean;
  disabled?: boolean;
  align?: keyof typeof alignments;
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
        'min-h-12 min-w-12 shrink-0 justify-center rounded-full active:opacity-pressed',
        alignments[align],
        disabled ? 'opacity-disabled' : '',
        className,
      ].join(' ')}
    >
      <Icon name={icon} tone={tone} />
    </Pressable>
  );
}
