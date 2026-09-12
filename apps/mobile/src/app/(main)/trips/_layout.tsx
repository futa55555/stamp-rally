import { Stack } from 'expo-router';
import { useStackScreenOptions } from '../../../shared/navigation/useStackScreenOptions';

export const unstable_settings = { initialRouteName: 'index' };

function routeTitle(params: object | undefined, fallback: string) {
  return params && 'title' in params && typeof params.title === 'string'
    ? params.title
    : fallback;
}

export default function TripsLayout() {
  const screenOptions = useStackScreenOptions({ postButton: true });
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: '旅行' }} />
      <Stack.Screen
        name="trip/[tripId]"
        options={({ route }) => ({ title: routeTitle(route.params, '旅行') })}
      />
      <Stack.Screen
        name="category/[categoryId]"
        options={({ route }) => ({
          title: routeTitle(route.params, 'カテゴリー'),
        })}
      />
      <Stack.Screen
        name="stamp/[stampId]"
        options={({ route }) => ({
          title: routeTitle(route.params, 'スタンプ'),
        })}
      />
      <Stack.Screen name="photo/[postId]" options={{ headerShown: false }} />
    </Stack>
  );
}
