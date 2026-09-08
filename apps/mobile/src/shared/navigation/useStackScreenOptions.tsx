import type { NativeStackNavigationOptions } from 'expo-router';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../theme/ThemeProvider';
import { PageHeader, TopHeader } from '../ui/Header';

export function useStackScreenOptions(): NativeStackNavigationOptions {
  const theme = useAppTheme();
  const router = useRouter();
  return {
    contentStyle: { backgroundColor: theme.colors.background },
    header: ({ options, navigation, route }) =>
      route.name === 'index' ? (
        <TopHeader onPost={() => router.push('/editor/post')} />
      ) : (
        <PageHeader
          backLabel="戻る"
          title={options.title ?? 'Stamp Rally'}
          onBack={() => navigation.goBack()}
        />
      ),
  };
}
