import type { NativeStackNavigationOptions } from 'expo-router';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { headerButtonOptions } from './headerButtonOptions';
import { usePostHeaderIcon } from './usePostHeaderIcon';

export function useStackScreenOptions({
  postButton = false,
} = {}): NativeStackNavigationOptions {
  const theme = useAppTheme();
  const router = useRouter();
  const postIcon = usePostHeaderIcon();
  return {
    headerShown: true,
    headerTintColor: theme.colors.text,
    headerBackButtonDisplayMode: 'default',
    headerBackButtonMenuEnabled: true,
    ...(Platform.OS === 'ios'
      ? {
          // Explicitly omit the title color to bypass the navigation theme's
          // fixed-color fallback and let UIKit adapt it to the background.
          headerTitleStyle: { color: undefined },
          headerTransparent: true,
          headerShadowVisible: false,
          // iOS 26 supplies its own scroll edge effect behind native bar items.
          ...(parseInt(String(Platform.Version), 10) < 26
            ? { headerBlurEffect: 'systemMaterial' as const }
            : {}),
        }
      : { headerStyle: { backgroundColor: theme.colors.surface } }),
    contentStyle: { backgroundColor: theme.colors.background },
    ...(postButton
      ? headerButtonOptions({
          label: '投稿を追加',
          symbol: 'camera',
          imageSource: postIcon,
          icon: 'camera-plus-outline',
          onPress: () => router.push('/editor/post'),
        })
      : {}),
  };
}
