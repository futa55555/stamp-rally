import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useTask } from '../../../shared/hooks/useTask';

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
