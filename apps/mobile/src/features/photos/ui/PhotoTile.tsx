import { useEffect } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useTask } from '../../../shared/hooks/useTask';
import { IconButton } from '../../../shared/ui/IconButton';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { useData } from '../../app-data/AppDataProvider';
import type { Post } from '../model/types';

export function PhotoTile({
  photo,
  onOpen,
}: {
  photo: Post;
  onOpen: () => void;
}) {
  const { actions } = useData();
  const task = useTask();
  useEffect(() => {
    if (task.error) Alert.alert('お気に入りを更新できませんでした', task.error);
  }, [task.error]);
  return (
    <View className="w-1/2">
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={(photo.author.name ?? '旅の仲間') + 'の写真を開く'}
        className="active:opacity-pressed"
      >
        <PhotoImage url={photo.mediaUrl} className="aspect-square" />
      </Pressable>
      <IconButton
        icon={photo.isFavorite ? 'heart' : 'heart-outline'}
        label={photo.isFavorite ? 'お気に入りを解除' : 'お気に入りに追加'}
        selected={photo.isFavorite}
        disabled={task.pending}
        tone={photo.isFavorite ? 'favorite' : 'onPhoto'}
        onPress={() => {
          void task.run(() => actions.setFavorite(photo.id, !photo.isFavorite));
        }}
        className="absolute right-0 top-0"
      />
    </View>
  );
}
