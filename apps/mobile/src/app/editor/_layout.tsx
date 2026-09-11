import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { Stack, useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorProvider } from '../../features/editor/EditorProvider';
import { useStackScreenOptions } from '../../shared/navigation/useStackScreenOptions';
import { headerButtonOptions } from '../../shared/navigation/headerButtonOptions';

export default function EditorLayout() {
  const options = useStackScreenOptions();
  const router = useRouter();
  return (
    <SafeAreaProvider>
      <ActionSheetProvider>
        <EditorProvider>
          <Stack
            screenOptions={{
              ...options,
              // Editor screens protect unsaved input with usePreventRemove.
              headerBackButtonMenuEnabled: false,
              gestureEnabled: false,
              headerBackVisible: false,
              ...headerButtonOptions({
                side: 'left',
                label: '閉じる',
                symbol: 'xmark',
                icon: 'close',
                onPress: () => {
                  if (router.canGoBack()) router.back();
                  else router.replace('/trips');
                },
              }),
            }}
          >
            <Stack.Screen name="post" options={{ title: '写真・動画を追加' }} />
            <Stack.Screen name="trip" options={{ title: '旅行' }} />
            <Stack.Screen name="genre" options={{ title: 'ジャンル' }} />
            <Stack.Screen name="stamp" options={{ title: 'スタンプ' }} />
          </Stack>
        </EditorProvider>
      </ActionSheetProvider>
    </SafeAreaProvider>
  );
}
