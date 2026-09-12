import { Stack } from 'expo-router';
import { useStackScreenOptions } from '../../../shared/navigation/useStackScreenOptions';

export default function Layout() {
  const screenOptions = useStackScreenOptions({ postButton: true });
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: '設定' }} />
      <Stack.Screen
        name="trash/index"
        options={{ title: 'ゴミ箱', headerRight: () => null }}
      />
      <Stack.Screen
        name="trash/[postId]"
        options={{ title: '投稿を復元', headerRight: () => null }}
      />
    </Stack>
  );
}
