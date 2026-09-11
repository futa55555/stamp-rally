import { Stack, useRouter } from 'expo-router';
import { useStackScreenOptions } from '../../shared/navigation/useStackScreenOptions';
import { headerButtonOptions } from '../../shared/navigation/headerButtonOptions';
export default function Layout() {
  const options = useStackScreenOptions();
  const router = useRouter();
  return (
    <Stack
      screenOptions={({ route, navigation }) => ({
        ...options,
        // This nested stack's first screen returns to the root navigator.
        ...(navigation.getState()?.routes[0]?.key === route.key
          ? headerButtonOptions({
              side: 'left',
              label: '戻る',
              symbol: 'chevron.left',
              icon: 'arrow-left',
              onPress: () => {
                if (router.canGoBack()) router.back();
                else router.replace('/trips');
              },
            })
          : {}),
      })}
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
