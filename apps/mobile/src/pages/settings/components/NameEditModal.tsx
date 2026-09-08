import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import type { useTask } from '../../../shared/hooks/useTask';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { IconButton } from '../../../shared/ui/IconButton';

export function NameEditModal({
  editing,
  name,
  setName,
  saveTask,
  close,
  save,
}: {
  editing: boolean;
  name: string;
  setName: (name: string) => void;
  saveTask: Pick<ReturnType<typeof useTask>, 'pending' | 'error'>;
  close: () => void;
  save: () => Promise<void>;
}) {
  const theme = useAppTheme();
  return (
    <Modal
      visible={editing}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            maxHeight: '90%',
            width: '100%',
            maxWidth: 480,
            alignSelf: 'center',
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: theme.spacing.lg,
              gap: theme.spacing.md,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppText
                variant="heading"
                accessibilityRole="header"
                style={{ flex: 1 }}
              >
                名前を変更
              </AppText>
              <IconButton
                icon="close"
                label="名前の変更を閉じる"
                onPress={close}
                disabled={saveTask.pending}
              />
            </View>
            <AppText variant="caption" tone="textSecondary">
              旅の仲間に表示される名前です。1〜20文字で入力してください。
            </AppText>
            <TextInput
              value={name}
              onChangeText={setName}
              accessibilityLabel="名前"
              autoFocus
              editable={!saveTask.pending}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={() => {
                void save();
              }}
              selectionColor={theme.colors.primary}
              placeholder="名前を入力"
              placeholderTextColor={theme.colors.textMuted}
              style={{
                ...theme.typography.body,
                color: theme.colors.text,
                backgroundColor: theme.colors.background,
                borderColor: saveTask.error
                  ? theme.colors.error
                  : theme.colors.border,
                borderWidth: 1,
                borderRadius: theme.radius.sm,
                padding: theme.spacing.md,
                minHeight: theme.layout.touchTarget,
              }}
            />
            <ErrorMessage message={saveTask.error} />
            <Button
              label="保存する"
              pending={saveTask.pending}
              onPress={() => {
                void save();
              }}
            />
            <Button
              label="キャンセル"
              variant="secondary"
              disabled={saveTask.pending}
              onPress={close}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
