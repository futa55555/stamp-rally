import { useEffect, useState, type PropsWithChildren } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AppText, Button, ErrorMessage, ListRow } from '../../components/ui';
import { Header } from '../../navigation/Header';
import { useAppTheme } from '../../theme/ThemeProvider';
import { dateLabel, localDate } from '../../data/dates';
import { useEditor } from './EditorProvider';

export function useEditorGuard(dirty: boolean, pending: boolean) {
  const navigation = useNavigation();
  const { finishing } = useEditor();
  const [departure, setDeparture] = useState<{ action: () => void } | null>(
    null,
  );
  usePreventRemove(
    (dirty || pending) && !finishing && !departure,
    ({ data }) => {
      if (pending) return;
      Alert.alert(
        '変更を破棄しますか？',
        '保存していない入力内容は失われます。',
        [
          { text: '入力を続ける', style: 'cancel' },
          {
            text: '破棄する',
            style: 'destructive',
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      );
    },
  );
  useEffect(() => {
    if (!departure) return;
    const frame = requestAnimationFrame(departure.action);
    return () => cancelAnimationFrame(frame);
  }, [departure]);
  return (action: () => void) => setDeparture({ action });
}

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

export function TextField({
  label,
  value,
  onChangeText,
  multiline = false,
  disabled = false,
  hint,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        testID={`input-${label}`}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        editable={!disabled}
        autoCapitalize="none"
        selectionColor={theme.colors.primary}
        placeholder={label}
        placeholderTextColor={theme.colors.textMuted}
        style={{
          ...theme.typography.body,
          color: theme.colors.text,
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderWidth: 1,
          borderRadius: theme.radius.sm,
          padding: theme.spacing.md,
          minHeight: multiline ? 120 : theme.layout.touchTarget,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {hint ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function DateField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const date = new Date(`${value}T12:00:00`);
  return (
    <View>
      <ListRow
        title={label}
        subtitle={dateLabel(value)}
        icon="calendar-blank-outline"
        onPress={
          disabled
            ? undefined
            : () => {
                Keyboard.dismiss();
                setOpen(!open);
              }
        }
      />
      {open && !disabled ? (
        <>
          <DateTimePicker
            value={date}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            locale="ja-JP"
            themeVariant="light"
            onDismiss={() => setOpen(false)}
            onValueChange={(_, selected) => {
              onChange(localDate(selected));
              if (Platform.OS !== 'ios') setOpen(false);
            }}
          />
          {Platform.OS === 'ios' ? (
            <Button
              label="日付を確定"
              variant="secondary"
              onPress={() => setOpen(false)}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
