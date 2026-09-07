import { Stack } from "expo-router";
import { useStackScreenOptions } from "../../../navigation/Header";

export default function Layout() {
  const screenOptions = useStackScreenOptions();
  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: "設定" }} />
    </Stack>
  );
}
