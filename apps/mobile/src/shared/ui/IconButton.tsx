import type { StyleProp, ViewStyle } from 'react-native';
import { Pressable } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
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
  style,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: ColorToken;
  selected?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={({ pressed }) => [
        {
          minHeight: theme.layout.touchTarget,
          minWidth: theme.layout.touchTarget,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: theme.radius.pill,
          opacity: disabled
            ? theme.opacity.disabled
            : pressed
              ? theme.opacity.pressed
              : 1,
        },
        style,
      ]}
    >
      <Icon name={icon} tone={tone} />
    </Pressable>
  );
}
