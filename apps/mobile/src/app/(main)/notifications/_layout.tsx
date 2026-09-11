import { Stack } from 'expo-router';
import { useStackScreenOptions } from '../../../shared/navigation/useStackScreenOptions';

export default function Layout() {
  const screenOptions = useStackScreenOptions({ postButton: true });
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: 'お知らせ' }} />
    </Stack>
  );
}
