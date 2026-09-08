import { useActionSheet } from '@expo/react-native-action-sheet';
import { useEffect, useRef } from 'react';
import { findNodeHandle, Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Option = { value: string; label: string };

export function SelectField({
  label,
  icon,
  value,
  placeholder,
  options,
  disabled = false,
  onChange,
  create,
}: {
  label: string;
  icon: IconName;
  value?: string;
  placeholder: string;
  options: Option[];
  disabled?: boolean;
  onChange: (value: string) => void;
  create?: { label: string; onPress: () => void };
}) {
  const { showActionSheetWithOptions } = useActionSheet();
  const theme = useAppTheme();
  const anchor = useRef<View>(null);
  const opened = useRef(false);
  const mounted = useRef(true);
  const current = useRef({ options, disabled, onChange, create });
  current.current = { options, disabled, onChange, create };
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const selected = options.find((option) => option.value === value);
  const unavailable = disabled || (!options.length && !create);

  return (
    <Pressable
      ref={anchor}
      accessibilityRole="button"
      accessibilityLabel={`${label}、${selected?.label ?? placeholder}`}
      accessibilityState={{ disabled: unavailable }}
      disabled={unavailable}
      className={[
        'min-h-16 flex-row items-center gap-3 px-4 py-3 active:bg-surfaceSubtle',
        unavailable ? 'opacity-disabled' : '',
      ].join(' ')}
      onPress={() => {
        if (unavailable || opened.current) return;
        opened.current = true;
        const labels = options.map((option) =>
          option.value === value ? `${option.label}（選択中）` : option.label,
        );
        const createIndex = create ? labels.push(create.label) - 1 : -1;
        const cancelIndex = labels.push('キャンセル') - 1;
        showActionSheetWithOptions(
          {
            title: `${label}を選択`,
            options: labels,
            cancelButtonIndex: cancelIndex,
            anchor: findNodeHandle(anchor.current) ?? undefined,
            tintColor: theme.colors.text,
            userInterfaceStyle: 'light',
            useModal: true,
            autoFocus: true,
            showSeparators: true,
            containerStyle: { backgroundColor: theme.colors.surface },
            titleTextStyle: { color: theme.colors.textSecondary },
            separatorStyle: { backgroundColor: theme.colors.border },
          },
          (index) => {
            opened.current = false;
            if (
              !mounted.current ||
              current.current.disabled ||
              index === undefined ||
              index === cancelIndex
            )
              return;
            if (index === createIndex) {
              current.current.create?.onPress();
              return;
            }
            const option = options[index];
            // The index belongs to the opened sheet; use its ID even if the
            // options have since reordered, and ignore removed/stale choices.
            if (
              option &&
              current.current.options.some(
                (item) => item.value === option.value,
              )
            )
              current.current.onChange(option.value);
          },
        );
      }}
    >
      <Icon name={icon} tone={unavailable ? 'textMuted' : 'primary'} />
      <View className="min-w-0 flex-1 gap-1">
        <AppText variant="caption" tone="textSecondary">
          {label}
        </AppText>
        <AppText
          variant="label"
          tone={selected ? 'text' : 'textMuted'}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {selected?.label ?? placeholder}
        </AppText>
      </View>
      <Icon name="chevron-down" size={20} tone="textMuted" />
    </Pressable>
  );
}
