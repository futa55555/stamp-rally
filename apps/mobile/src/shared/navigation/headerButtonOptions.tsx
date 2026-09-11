import type { NativeStackNavigationOptions } from 'expo-router';
import { Platform, type ImageSourcePropType } from 'react-native';
import type { IconName } from '../ui/Icon';
import { IconButton } from '../ui/IconButton';

export function headerButtonOptions({
  side = 'right',
  label,
  symbol,
  imageSource,
  icon,
  onPress,
  disabled = false,
}: {
  side?: 'left' | 'right';
  label: string;
  symbol: 'camera' | 'xmark' | 'chevron.left';
  imageSource?: ImageSourcePropType;
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
          label,
          accessibilityLabel: label,
          icon: imageSource
            ? { type: 'image', source: imageSource, tinted: true }
            : { type: 'sfSymbol', name: symbol },
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
