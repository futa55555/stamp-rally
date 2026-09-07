import { Stack } from "expo-router";
import { useStackScreenOptions } from "../../../navigation/Header";

export const unstable_settings = { initialRouteName: "index" };

export default function TripsLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "Stamp Rally" }} />
      <Stack.Screen name="trip/[tripId]" options={{ title: "旅行のホーム" }} />
      <Stack.Screen name="genre/[genreId]" options={{ title: "ジャンル" }} />
      <Stack.Screen name="stamp/[stampId]" options={{ title: "スタンプ" }} />
      <Stack.Screen name="photo/[postId]" options={{ title: "旅の一枚" }} />
    </Stack>
  );
}
