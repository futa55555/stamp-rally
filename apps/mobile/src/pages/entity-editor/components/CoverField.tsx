import { useActionSheet } from '@expo/react-native-action-sheet';
import { useRef } from 'react';
import { findNodeHandle, Pressable, View } from 'react-native';
import type { usePhotoPicker } from '../../../features/photos/hooks/usePhotoPicker';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
export function CoverField({
  uri,
  onRemove,
  picker,
  disabled,
}: {
  uri: string | null;
  onRemove: () => void;
  picker: ReturnType<typeof usePhotoPicker>;
  disabled: boolean;
}) {
  const { showActionSheetWithOptions } = useActionSheet();
  const theme = useAppTheme();
  const anchor = useRef<View>(null);
  const opened = useRef(false);
  return (
    <View className="gap-2">
      <Pressable
        ref={anchor}
        accessibilityRole="button"
        accessibilityLabel={
          uri ? 'カバー画像を変更' : 'カバー画像を選択（任意）'
        }
        disabled={disabled}
        accessibilityState={{ disabled }}
        className="overflow-hidden rounded-lg border border-border active:opacity-pressed"
        onPress={() => {
          if (opened.current) return;
          opened.current = true;
          showActionSheetWithOptions(
            {
              options: ['ライブラリから選ぶ', '撮影する', 'キャンセル'],
              cancelButtonIndex: 2,
              anchor: findNodeHandle(anchor.current) ?? undefined,
              tintColor: theme.colors.primary,
              userInterfaceStyle: 'light',
              useModal: true,
              autoFocus: true,
            },
            (index) => {
              opened.current = false;
              if (index === 0) picker.library();
              if (index === 1) picker.camera();
            },
          );
        }}
      >
        {uri ? (
          <PhotoImage url={uri} className="aspect-[1.6]" />
        ) : (
          <View className="min-h-[160px] items-center justify-center gap-3 bg-surface p-4">
            <Icon name="camera-plus-outline" tone="primary" size={32} />
            <AppText tone="textSecondary">カバー画像（任意）</AppText>
          </View>
        )}
      </Pressable>
      {uri ? (
        <Button
          label="カバー画像を解除"
          variant="secondary"
          icon="close"
          onPress={onRemove}
          disabled={disabled}
        />
      ) : null}
      {picker.pending ? (
        <AppText variant="caption" tone="textSecondary">
          写真を準備しています…
        </AppText>
      ) : null}
    </View>
  );
}
