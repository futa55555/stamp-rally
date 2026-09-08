import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { IconButton } from '../../../shared/ui/IconButton';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import type { usePhotoPicker } from '../hooks/usePhotoPicker';

export function PhotoField({
  uris,
  onRemove,
  picker,
  disabled,
  max,
  label = '写真',
}: {
  uris: string[];
  onRemove: (index: number) => void;
  picker: ReturnType<typeof usePhotoPicker>;
  disabled: boolean;
  max: number;
  label?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <View className="gap-3">
      <AppText variant="heading">
        {label}{' '}
        <AppText tone="textMuted">
          {uris.length} / {max}
        </AppText>
      </AppText>
      {uris.length ? (
        <View className="flex-row flex-wrap gap-2">
          {uris.map((uri, index) => (
            <View key={`${index}-${uri}`} className="w-[30%] gap-1">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}枚目の写真を拡大`}
                onPress={() => setPreview(uri)}
                disabled={disabled}
              >
                <PhotoImage url={uri} className="aspect-square rounded-lg" />
              </Pressable>
              <IconButton
                icon="close-circle-outline"
                label={`${index + 1}枚目の写真を選択解除`}
                disabled={disabled}
                onPress={() => onRemove(index)}
              />
            </View>
          ))}
        </View>
      ) : (
        <AppText tone="textSecondary">
          ライブラリから選ぶか、カメラで撮影してください。
        </AppText>
      )}
      <Button
        label={max === 1 && uris.length ? '写真を変更' : 'ライブラリから選ぶ'}
        icon="image-multiple-outline"
        variant="secondary"
        disabled={disabled || (max > 1 && uris.length >= max)}
        onPress={picker.library}
      />
      <Button
        label="カメラで撮影"
        icon="camera-outline"
        variant="secondary"
        disabled={disabled || (max > 1 && uris.length >= max)}
        onPress={picker.camera}
      />
      {picker.pending ? (
        <AppText tone="textSecondary">写真を準備しています…</AppText>
      ) : null}
      <Modal
        visible={!!preview}
        animationType="fade"
        onRequestClose={() => setPreview(null)}
      >
        <SafeAreaView className="flex-1 bg-photoBackground">
          <View className="items-end p-3">
            <IconButton
              icon="close"
              label="写真の拡大を閉じる"
              tone="onPhoto"
              onPress={() => setPreview(null)}
            />
          </View>
          <PhotoImage url={preview} fit="contain" className="flex-1" />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
