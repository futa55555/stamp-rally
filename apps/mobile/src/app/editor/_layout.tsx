import { Stack } from 'expo-router';
import { EditorProvider } from '../../features/editor/EditorProvider';

export default function EditorLayout() {
  return (
    <EditorProvider>
      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
    </EditorProvider>
  );
}
