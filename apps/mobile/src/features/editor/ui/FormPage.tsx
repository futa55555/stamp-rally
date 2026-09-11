import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { FormHeader } from '../../../shared/ui/Header';

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
  const router = useRouter();
  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <FormHeader
        title={title}
        onClose={() => {
          if (pending) return;
          if (router.canGoBack()) router.back();
          else router.replace('/trips');
        }}
        disabled={pending}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-4 py-6 gap-6 w-full max-w-page self-center"
        >
          {children}
        </ScrollView>
        <View className="p-4 gap-2 border-t border-border">
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
