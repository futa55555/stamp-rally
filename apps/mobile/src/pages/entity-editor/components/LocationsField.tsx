import { useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
export function LocationsField({
  values,
  onChange,
  disabled,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  disabled: boolean;
}) {
  const theme = useAppTheme();
  const inputRef = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const location = draft.trim();
  const duplicate = values.some((value) => value.trim() === location);
  const canAdd = !disabled && !!location && !duplicate;
  const addLocation = () => {
    if (!canAdd) return;
    onChange([...values, location]);
    setDraft('');
    inputRef.current?.focus();
  };
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-2">
        <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4">
          <Icon name="map-marker-outline" size={20} />
          <TextInput
            ref={inputRef}
            accessibilityLabel="行き先（任意）"
            placeholder="行き先（任意）"
            placeholderTextColor={theme.colors.textMuted}
            selectionColor={theme.colors.primary}
            value={draft}
            editable={!disabled}
            allowFontScaling
            onChangeText={setDraft}
            className="min-h-12 min-w-0 flex-1 py-4 text-body text-text"
          />
        </View>
        <Button label="追加" disabled={!canAdd} onPress={addLocation} />
      </View>
      {location && duplicate ? (
        <AppText variant="caption" tone="textMuted">
          この行き先は追加済みです。
        </AppText>
      ) : null}
      {values.length ? (
        <View className="flex-row flex-wrap gap-2">
          {values.map((value, index) => (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={`${value}を行き先から削除`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              hitSlop={6}
              onPress={() => onChange(values.filter((_, i) => i !== index))}
              className={[
                'min-h-8 max-w-full flex-row items-center gap-1 rounded-full bg-activeBackground px-3 py-1.5 active:opacity-pressed',
                disabled ? 'opacity-disabled' : '',
              ].join(' ')}
            >
              <AppText
                variant="caption"
                tone="active"
                className="shrink font-semibold"
              >
                {value}
              </AppText>
              <Icon name="close" size={16} tone="active" />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
