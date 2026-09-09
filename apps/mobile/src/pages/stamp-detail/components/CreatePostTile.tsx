import { Pressable } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';

export function CreatePostTile({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="写真・動画を追加"
      onPress={onPress}
      className="aspect-square w-1/2 items-center justify-center bg-border active:opacity-pressed"
    >
      <Icon name="camera-outline" size={32} tone="textMuted" />
      <AppText variant="caption" tone="textMuted">
        写真・動画を追加
      </AppText>
    </Pressable>
  );
}
