import * as ImagePicker from 'expo-image-picker';
import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useTask } from '../../../shared/hooks/useTask';
import { validateMediaSelection, type PickedMedia } from '../model/inputs';

const mimeByExtension: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  avif: 'image/avif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
};

export function usePhotoPicker(
  onPicked: (files: PickedMedia[]) => void,
  remaining: number,
) {
  const task = useTask();
  const accept = useRef(onPicked);
  const slots = useRef(remaining);
  accept.current = onPicked;
  slots.current = remaining;
  const process = async (
    result:
      ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
  ) => {
    if (!result) return;
    if ('code' in result)
      throw new Error(
        '写真・動画を取得できませんでした。もう一度お試しください。',
      );
    if (result.canceled) return;
    if (result.assets.length > slots.current)
      throw new Error(`追加できる写真・動画はあと${slots.current}件です。`);
    const files = result.assets.map((asset): PickedMedia => {
      if (!asset.uri || (asset.type !== 'image' && asset.type !== 'video'))
        throw new Error('写真・動画を選び直してください。');
      // The system picker resolves iCloud assets before returning its local URI.
      // Query the returned file: a Photos asset's metadata can describe a different representation.
      const file = new File(asset.uri);
      const fileName = asset.fileName ?? file.name;
      const extension = fileName.split('.').at(-1)?.toLowerCase() ?? '';
      return {
        clientId: randomUUID(),
        uri: asset.uri,
        fileName,
        mimeType:
          asset.mimeType?.toLowerCase() ?? mimeByExtension[extension] ?? '',
        byteSize: file.size || asset.fileSize || 0,
        mediaType: asset.type === 'video' ? 'VIDEO' : 'IMAGE',
        ...(asset.duration == null ? {} : { durationMs: asset.duration }),
      };
    });
    validateMediaSelection(files);
    accept.current(files);
  };
  const processRef = useRef(process);
  processRef.current = process;
  useEffect(() => {
    if (Platform.OS === 'android')
      void task.run(async () =>
        processRef.current(await ImagePicker.getPendingResultAsync()),
      );
  }, [task.run]);
  const pick = (source: 'library' | 'camera') =>
    task.run(async () => {
      if (slots.current < 1)
        throw new Error('選択した写真・動画を減らしてください。');
      if (source === 'camera' || Platform.OS === 'ios') {
        const permission =
          source === 'camera'
            ? await ImagePicker.requestCameraPermissionsAsync()
            : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          if (!permission.canAskAgain)
            Alert.alert(
              'アクセスを許可してください',
              '端末の設定からアクセスを許可できます。',
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
            source === 'camera'
              ? 'カメラへのアクセス許可が必要です。'
              : '原本の取得には写真ライブラリへのアクセス許可が必要です。',
          );
        }
      }
      await process(
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              allowsEditing: false,
              quality: 1,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images', 'videos'],
              allowsMultipleSelection: slots.current > 1,
              selectionLimit: slots.current,
              orderedSelection: true,
              allowsEditing: false,
              preferredAssetRepresentationMode:
                ImagePicker.UIImagePickerPreferredAssetRepresentationMode
                  .Current,
              videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
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
