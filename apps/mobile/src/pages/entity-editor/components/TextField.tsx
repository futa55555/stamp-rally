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
