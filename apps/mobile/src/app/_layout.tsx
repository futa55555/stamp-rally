import { pendingInvitation } from '../features/invitations/runtime';
import { FormHeader } from '../shared/ui/Header';
import { InvitationIntake } from '../features/invitations/InvitationIntake';
import '../../global.css';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFonts } from 'expo-font';
import {
  ThemeProvider as NavigationThemeProvider,
  Stack,
  useRouter,
} from 'expo-router';
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { UploadProvider } from '../features/uploads/UploadProvider';

export const unstable_settings = { initialRouteName: '(main)' };

function RootNavigation() {
  const theme = useAppTheme();
  const router = useRouter();
  const store = useAppStore();
  const [fontsLoaded, fontError] = useFonts(MaterialCommunityIcons.font);

  return (
    <NavigationThemeProvider value={navigationTheme(theme)}>
      <InvitationIntake />
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      {fontError ||
      !fontsLoaded ||
      store.status === 'loading' ||
      store.status === 'error' ? (
        <AppLoadingState
          fontError={fontError}
          error={store.error}
          reload={store.reload}
        />
      ) : (
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Protected guard={store.user?.status === 'ACTIVE'}>
            <Stack.Screen name="(main)" />
            <Stack.Screen
              name="invitations"
              options={{ animation: 'slide_from_right' }}
            />
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
          <Stack.Protected guard={store.user?.status === 'ONBOARDING'}>
            <Stack.Screen name="onboarding" />
          </Stack.Protected>
          <Stack.Protected guard={!store.userId}>
            <Stack.Screen name="login" />
          </Stack.Protected>
          <Stack.Screen
            name="invite/[token]"
            options={{
              headerShown: true,
              header: () => (
                <FormHeader
                  title="旅行への招待"
                  onClose={() => {
                    void pendingInvitation
                      .clear()
                      .catch(() => {})
                      .then(() => router.replace('/trips'));
                  }}
                />
              ),
            }}
          />
        </Stack>
      )}
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AppDataProvider>
          <UploadProvider>
            <RootNavigation />
          </UploadProvider>
        </AppDataProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
