import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { File, Paths } from 'expo-file-system';
import { useTask } from '../../../shared/hooks/useTask';
import { ErrorMessage } from '../../../shared/ui/ErrorMessage';
import { centerCropRectangle } from '../../../features/trip-covers/crop';
import { TripCoverImage } from '../../../features/trip-covers/TripCoverImage';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { PhotoImage } from '../../../shared/ui/PhotoImage';

export function CoverField({
  uri,
  tripId,
  onSelect,
  onRemove,
  onPendingChange,
  disabled,
}: {
  uri: string | null;
  tripId?: string;
  onSelect: (uri: string) => Promise<void>;
  onRemove: () => void;
  onPendingChange: (pending: boolean) => void;
  disabled: boolean;
}) {
  const task = useTask();
  const alive = useRef(true);
  useEffect(() => {
    onPendingChange(task.pending);
  }, [task.pending, onPendingChange]);
  const process = async (
    result:
      ImagePicker.ImagePickerResult | ImagePicker.ImagePickerErrorResult | null,
  ) => {
    if (!result) return;
    if ('code' in result)
      throw new Error('写真を読み込めませんでした。もう一度選んでください。');
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset || (asset.type && asset.type !== 'image'))
      throw new Error('写真を1枚選んでください。');
    if (
      asset.mimeType &&
      ![
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/avif',
      ].includes(asset.mimeType.toLowerCase())
    )
      throw new Error('JPEG・PNG・WebP・HEIC・AVIFの写真を選んでください。');
    const file = new File(asset.uri);
    if (
      !file.exists ||
      file.size > 50_000_000 ||
      file.size < 1 ||
      asset.width * asset.height > 100_000_000
    )
      throw new Error('50MB・1億画素以内の写真を選んでください。');
    // Center the crop after correcting HEIC/EXIF orientation.
    const decoded = await ImageManipulator.manipulate(asset.uri).renderAsync();
    if (!alive.current) return;
    const rect = centerCropRectangle(decoded);
    const context = ImageManipulator.manipulate(decoded).crop(rect);
    if (rect.width > 2560) context.resize({ width: 2560, height: 1600 });
    const cropped = await context.renderAsync();
    const selected = await cropped.saveAsync({ format: SaveFormat.PNG });
    try {
      if (alive.current) await onSelect(selected.uri);
    } finally {
      if (selected.uri.startsWith(Paths.cache.uri)) {
        try {
          new File(selected.uri).delete();
        } catch {
          /* Cache eviction also removes temporary crops. */
        }
      }
    }
  };
  useEffect(() => {
    alive.current = true;
    if (Platform.OS === 'android')
      void task.run(async () =>
        process(await ImagePicker.getPendingResultAsync()),
      );
    return () => {
      alive.current = false;
    };
  }, []);
  const pick = () =>
    void task.run(async () =>
      process(
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: false,
          allowsEditing: false,
          quality: 1,
        }),
      ),
    );
  return (
    <View className="gap-2">
      <AppText variant="label">カバー画像（任意）</AppText>
      {uri ? (
        tripId && uri.startsWith('https://') ? (
          <TripCoverImage
            trip={{ id: tripId, coverImageUrl: uri }}
            className="aspect-[1.6] rounded-lg"
          />
        ) : (
          <PhotoImage url={uri} className="aspect-[1.6] rounded-lg" />
        )
      ) : null}
      <Button
        label={uri ? '画像を変更' : '画像を選ぶ'}
        variant="secondary"
        onPress={pick}
        disabled={disabled}
        pending={task.pending}
      />
      <ErrorMessage message={task.error} />
      {uri ? (
        <Button
          label="カバー画像を解除"
          variant="secondary"
          icon="close"
          onPress={onRemove}
          disabled={disabled || task.pending}
        />
      ) : null}
    </View>
  );
}
