import { useRef, useState } from 'react';
import { TextInput, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { IconButton } from '../../../shared/ui/IconButton';
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
  // Stable row keys keep keyboard focus when an earlier destination is removed.
  const nextId = useRef(values.length);
  const [keys, setKeys] = useState(() => values.map((_, i) => i));
  return (
    <View className="gap-2">
      {values.map((value, index) => (
        <View key={keys[index]} className="flex-row items-center gap-2">
          <View className="min-w-0 flex-1 flex-row items-center gap-2 rounded-lg border border-border bg-surface px-4">
            <Icon name="map-marker-outline" size={20} />
            <TextInput
              accessibilityLabel={index + 1 + '件目の行き先'}
              placeholder="行き先（任意）"
              placeholderTextColor={theme.colors.textMuted}
              selectionColor={theme.colors.primary}
              value={value}
              editable={!disabled}
              allowFontScaling
              onChangeText={(text) =>
                onChange(
                  values.map((location, i) => (i === index ? text : location)),
                )
              }
              className="min-h-12 min-w-0 flex-1 py-4 text-body text-text"
            />
          </View>
          <IconButton
            icon="close"
            label={index + 1 + '件目の行き先を削除'}
            disabled={disabled}
            onPress={() => {
              setKeys(keys.filter((_, i) => i !== index));
              onChange(values.filter((_, i) => i !== index));
            }}
          />
        </View>
      ))}
      <Button
        label="行き先を追加（任意）"
        icon="map-marker-plus-outline"
        variant="secondary"
        disabled={disabled}
        onPress={() => {
          setKeys([...keys, nextId.current++]);
          onChange([...values, '']);
        }}
      />
    </View>
  );
}
