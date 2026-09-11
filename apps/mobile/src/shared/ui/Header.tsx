import { Stack } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';
import { headerButtonOptions } from '../navigation/headerButtonOptions';
import { useStackScreenOptions } from '../navigation/useStackScreenOptions';
import { useAppTheme } from '../theme/ThemeProvider';

export function PageHeader({
  title,
  backTitle,
  onBack,
}: {
  title: string;
  backTitle?: string;
  onBack: () => void;
}) {
  const options = useStackScreenOptions();
  const theme = useAppTheme();
  const hasBackScreen = useNavigationState((state) => state.index > 0);
  return (
    <Stack.Screen
      options={{
        ...options,
        title,
        headerBackTitle: backTitle,
        // Keep the full-screen gallery sized below the native bar.
        headerTransparent: false,
        headerBlurEffect: undefined,
        headerStyle: { backgroundColor: theme.colors.background },
        headerRight: undefined,
        unstable_headerRightItems: () => [],
        ...(hasBackScreen
          ? {
              headerLeft: undefined,
              unstable_headerLeftItems: undefined,
            }
          : headerButtonOptions({
              side: 'left',
              label: backTitle ? `${backTitle}へ戻る` : '戻る',
              symbol: 'chevron.left',
              icon: 'arrow-left',
              onPress: onBack,
            })),
      }}
    />
  );
}

export function FormHeader({
  title,
  onClose,
  disabled = false,
}: {
  title: string;
  onClose: () => void;
  disabled?: boolean;
}) {
  return (
    <Stack.Screen
      options={{
        title,
        headerShown: true,
        headerBackVisible: false,
        ...headerButtonOptions({
          side: 'left',
          label: '閉じる',
          symbol: 'xmark',
          icon: 'close',
          onPress: onClose,
          disabled,
        }),
      }}
    />
  );
}
