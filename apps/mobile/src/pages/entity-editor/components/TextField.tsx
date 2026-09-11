import type { Ref } from 'react';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
export function TextField({
  label,
  value,
  onChangeText,
  multiline = false,
  disabled = false,
  hint,
  hideLabel = false,
  autoFocus = false,
  inputRef,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  disabled?: boolean;
  hint?: string;
  hideLabel?: boolean;
  autoFocus?: boolean;
  inputRef?: Ref<TextInput>;
}) {
  const theme = useAppTheme();
  return (
    <View className="gap-2">
      {!hideLabel ? <AppText variant="label">{label}</AppText> : null}
      <TextInput
        ref={inputRef}
        testID={'input-' + label}
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        editable={!disabled}
        autoFocus={autoFocus}
        autoCapitalize="none"
        allowFontScaling
        selectionColor={theme.colors.primary}
        placeholder={label}
        placeholderTextColor={theme.colors.textMuted}
        className={[
          'text-body text-text bg-surface border-border border rounded-lg p-4',
          multiline ? 'min-h-[120px] align-top' : 'min-h-12 align-middle',
        ].join(' ')}
      />
      {hint && !hideLabel ? (
        <AppText variant="caption" tone="textMuted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}
