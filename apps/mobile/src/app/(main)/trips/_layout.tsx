import { TripStackHeader } from '../../../features/trips/navigation/TripStackHeader';
import { Stack } from 'expo-router';
import { useStackScreenOptions } from '../../../shared/navigation/useStackScreenOptions';

export const unstable_settings = { initialRouteName: 'index' };

export default function TripsLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack
      screenOptions={({ route }) => ({
        ...screenOptions,
        ...(route.name !== 'photo/[postId]'
          ? {
              header: () => (
                <TripStackHeader name={route.name} params={route.params} />
              ),
            }
          : {}),
      })}
    >
      <Stack.Screen name="index" options={{ title: 'Stamp Rally' }} />
      <Stack.Screen name="trip/[tripId]" options={{ title: '旅行のホーム' }} />
      <Stack.Screen name="genre/[genreId]" options={{ title: 'ジャンル' }} />
      <Stack.Screen name="stamp/[stampId]" options={{ title: 'スタンプ' }} />
      <Stack.Screen name="photo/[postId]" options={{ headerShown: false }} />
    </Stack>
  );
}
