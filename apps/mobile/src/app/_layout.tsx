import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import { ThemeProvider as NavigationThemeProvider, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  AppDataProvider,
  useAppStore,
} from '../features/app-data/AppDataProvider';
import {
  ThemeProvider,
  navigationTheme,
  useAppTheme,
} from '../shared/theme/ThemeProvider';
import { AppLoadingState } from '../shared/ui/AppLoadingState';

export const unstable_settings = { initialRouteName: '(main)' };

function RootNavigation() {
  const theme = useAppTheme();
  const store = useAppStore();
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {fontError || !fontsLoaded || !store.data ? (
        <AppLoadingState
          fontError={fontError}
          error={store.error}
          reload={store.reload}
        />
      ) : (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Protected guard={!!store.userId}>
            <Stack.Screen name="(main)" />
            <Stack.Screen name="index" />
            <Stack.Screen
              name="editor"
              options={{
                presentation: 'fullScreenModal',
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            />
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
