import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Modal, Platform, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, IconButton } from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { useAppTheme } from '../../theme/ThemeProvider';
import { useTask } from '../hooks';

export function usePhotoPicker(
  onPicked: (uris: string[]) => void,
  remaining: number,
) {
  const task = useTask();
  const accept = useRef(onPicked);
  const slots = useRef(remaining);
  accept.current = onPicked;
  slots.current = remaining;
  const process = (
    result:
      ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
  ) => {
    if (!result) return;
    if ('code' in result)
      throw new Error('写真を取得できませんでした。もう一度お試しください。');
    if (result.canceled) return;
    if (
      !result.assets.length ||
      result.assets.some(
        (asset) => !asset.uri || (asset.type && asset.type !== 'image'),
      )
    )
      throw new Error('写真を選び直してください。');
    if (result.assets.length > slots.current)
      throw new Error(`追加できる写真はあと${slots.current}枚です。`);
    accept.current(result.assets.map((asset) => asset.uri));
  };
  const processRef = useRef(process);
  processRef.current = process;
  useEffect(() => {
    if (Platform.OS === 'android') {
      void task.run(async () =>
        processRef.current(await ImagePicker.getPendingResultAsync()),
      );
    }
  }, [task.run]);
  const pick = (source: 'library' | 'camera') =>
    task.run(async () => {
      if (slots.current < 1)
        throw new Error(
          '写真の上限に達しました。選択した写真を減らしてください。',
        );
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain)
            Alert.alert(
              'カメラを許可してください',
              '端末の設定からカメラへのアクセスを許可できます。',
              [
                { text: '閉じる', style: 'cancel' },
                {
                  text: '設定を開く',
                  onPress: () => {
                    void Linking.openSettings().catch(() => {});
                  },
                },
              ],
            );
          throw new Error(
            '撮影にはカメラへのアクセス許可が必要です。写真ライブラリからも選べます。',
          );
        }
      }
      process(
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              allowsMultipleSelection: slots.current > 1,
              selectionLimit: slots.current,
              orderedSelection: true,
              allowsEditing: false,
              quality: 1,
            }),
      );
    });
  return {
    ...task,
    library: () => {
      void pick('library');
    },
    camera: () => {
      void pick('camera');
    },
  };
}

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
  const theme = useAppTheme();
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <AppText variant="heading">
        {label}{' '}
        <AppText tone="textMuted">
          {uris.length} / {max}
        </AppText>
      </AppText>
      {uris.length ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: theme.spacing.xs,
          }}
        >
          {uris.map((uri, index) => (
            <View
              key={`${index}-${uri}`}
              style={{ width: '30%', gap: theme.spacing.xxs }}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${index + 1}枚目の写真を拡大`}
                onPress={() => setPreview(uri)}
                disabled={disabled}
              >
                <PhotoImage
                  url={uri}
                  style={{ aspectRatio: 1, borderRadius: theme.radius.sm }}
                />
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
        <SafeAreaView
          style={{ flex: 1, backgroundColor: theme.colors.photoBackground }}
        >
          <View style={{ alignItems: 'flex-end', padding: theme.spacing.sm }}>
            <IconButton
              icon="close"
              label="写真の拡大を閉じる"
              tone="onPhoto"
              onPress={() => setPreview(null)}
            />
          </View>
          <PhotoImage url={preview} fit="contain" style={{ flex: 1 }} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
