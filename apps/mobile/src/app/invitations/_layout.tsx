import { PageHeader } from '../../shared/ui/Header';
import { Stack, useRouter } from 'expo-router';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
export default function Layout() {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        header: ({ options }) => (
          <PageHeader
            title={options.title ?? '参加申請'}
            backLabel="戻る"
            onBack={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/trips');
            }}
          />
        ),
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: '参加申請' }} />
      <Stack.Screen name="[id]" options={{ title: '申請の確認' }} />
      <Stack.Screen
        name="received/[linkId]"
        options={{ title: '旅行への招待' }}
      />
      <Stack.Screen name="trip/[tripId]" options={{ title: '招待管理' }} />
    </Stack>
  );
}
