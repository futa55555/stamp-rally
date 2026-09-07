import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Stack, ThemeProvider as NavigationThemeProvider } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ThemeProvider,
  navigationTheme,
  useAppTheme,
} from "../theme/ThemeProvider";
import { AppDataProvider, useAppStore } from "../data/AppDataProvider";
import { StateView } from "../components/ui";

export const unstable_settings = { initialRouteName: "(main)" };

function RootNavigation() {
  const theme = useAppTheme();
  const store = useAppStore();
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <StatusBar style={theme.dark ? "light" : "dark"} />
      {fontError || !fontsLoaded || !store.data ? (
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.background }}
        >
          <StateView
            title={
              fontError
                ? "アイコンを読み込めませんでした"
                : store.error
                  ? "読み込みに失敗しました"
                  : "旅の準備をしています"
            }
            description={
              fontError
                ? "アプリを再起動してください。"
                : (store.error ?? undefined)
            }
            loading={!fontError && !store.error}
            action={
              !fontError && store.error
                ? {
                    label: "再試行",
                    onPress: () => {
                      void store.reload();
                    },
                  }
                : undefined
            }
          />
        </SafeAreaView>
      ) : (
        <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
          <Stack.Protected guard={!!store.userId}>
            <Stack.Screen name="(main)" />
            <Stack.Screen name="index" />
          </Stack.Protected>
          <Stack.Protected guard={!store.userId}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      )}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppDataProvider>
        <RootNavigation />
      </AppDataProvider>
    </ThemeProvider>
  );
}
