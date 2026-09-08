import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { EditorProvider } from '../../features/editor/EditorProvider';

export default function EditorLayout() {
  return (
    <SafeAreaProvider>
      <ActionSheetProvider>
        <EditorProvider>
          <Stack
            screenOptions={{ headerShown: false, gestureEnabled: false }}
          />
        </EditorProvider>
      </ActionSheetProvider>
    </SafeAreaProvider>
  );
}
