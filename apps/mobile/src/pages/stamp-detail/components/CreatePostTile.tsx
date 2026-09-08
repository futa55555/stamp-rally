import { Pressable } from 'react-native';
import { Icon } from '../../../shared/ui/Icon';

export function CreatePostTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="写真を投稿"
      onPress={onPress}
      className="aspect-square w-1/2 items-center justify-center bg-border active:opacity-pressed"
    >
      <Icon name="camera-outline" size={32} tone="textMuted" />
    </Pressable>
  );
}
