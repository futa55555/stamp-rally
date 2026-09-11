import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform } from 'react-native';
import type { IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export function headerButtonOptions({
  side = 'right',
  label,
  symbol,
  icon,
  onPress,
  disabled = false,
}: {
  side?: 'left' | 'right';
  label: string;
  symbol: 'plus' | 'xmark' | 'chevron.left';
  icon: IconName;
  onPress: () => void;
  disabled?: boolean;
}): NativeStackNavigationOptions {
  if (Platform.OS === 'ios') {
    // The same native bar items used by Stack.Toolbar.Button. UIKit supplies
    // their Liquid Glass backgrounds and interactions on iOS 26 and later.
    return {
      [side === 'left'
        ? 'unstable_headerLeftItems'
        : 'unstable_headerRightItems']: () => [
        {
          type: 'button',
          // Icon-only buttons retain their name for accessibility.
          label: '',
          accessibilityLabel: label,
          icon: { type: 'sfSymbol', name: symbol },
          onPress,
          disabled,
        },
      ],
    };
  }
  return {
    [side === 'left' ? 'headerLeft' : 'headerRight']: () => (
      <IconButton
        icon={icon}
        label={label}
        onPress={onPress}
        disabled={disabled}
      />
    ),
  };
}
