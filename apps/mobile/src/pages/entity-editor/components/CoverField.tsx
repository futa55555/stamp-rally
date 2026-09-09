import { View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { PhotoImage } from '../../../shared/ui/PhotoImage';

export function CoverField({
  uri,
  onRemove,
  disabled,
}: {
  uri: string | null;
  onRemove: () => void;
  disabled: boolean;
}) {
  return (
    <View className="gap-2">
      {uri ? (
        <PhotoImage url={uri} className="aspect-[1.6] rounded-lg" />
      ) : null}
      <AppText tone="textSecondary">
        カバー画像の追加・変更は準備中です。
      </AppText>
      {uri ? (
        <Button
          label="カバー画像を解除"
          variant="secondary"
          icon="close"
          onPress={onRemove}
          disabled={disabled}
        />
      ) : null}
    </View>
  );
}
