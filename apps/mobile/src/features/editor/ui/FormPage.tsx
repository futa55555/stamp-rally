import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { Header } from '../../../shared/ui/Header';

export function FormPage({
  title,
  children,
  pending,
  error,
  onSave,
  saveLabel = '保存する',
  disabled = false,
}: PropsWithChildren<{
  title: string;
  pending: boolean;
  error: string | null;
  onSave: () => void;
  saveLabel?: string;
  disabled?: boolean;
}>) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Header
        title={title}
        onBack={() => {
          if (!pending) router.back();
        }}
        backDisabled={pending}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: theme.spacing.lg,
            gap: theme.spacing.lg,
            width: '100%',
            maxWidth: theme.layout.pageMaxWidth,
            alignSelf: 'center',
          }}
        >
          {children}
        </ScrollView>
        <View
          style={{
            padding: theme.spacing.md,
            gap: theme.spacing.xs,
            borderTopWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <ErrorMessage message={error} />
          <Button
            label={saveLabel}
            pending={pending}
            disabled={disabled}
            onPress={onSave}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
