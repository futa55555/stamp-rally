import type { NativeStackNavigationOptions } from 'expo-router';
import { useAppTheme } from '../theme/ThemeProvider';
import { Header } from '../ui/Header';

export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useAppTheme();
  return {
    contentStyle: { backgroundColor: theme.colors.background },
    header: ({ options, navigation, back }) => (
      <Header
        title={options.title ?? 'Stamp Rally'}
        onBack={back ? () => navigation.goBack() : undefined}
        action={options.headerRight?.({
          canGoBack: !!back,
          tintColor: theme.colors.primary,
        })}
      />
    ),
  };
}
