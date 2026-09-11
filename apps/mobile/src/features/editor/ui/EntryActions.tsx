import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { AppText } from '../../../shared/ui/AppText';
import { Icon } from '../../../shared/ui/Icon';
import type { EntityKind } from '../model/types';

export function EditableTitle({
  title,
  kind,
  id,
  viaGenreId,
}: {
  title: string;
  kind: EntityKind;
  id: string;
  viaGenreId?: string;
}) {
  const router = useRouter();
  return (
    <View className="flex-row items-start gap-3">
      <AppText
        variant="title"
        accessibilityRole="header"
        className="flex-1 py-2"
      >
        {title}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="編集"
        onPress={() =>
          router.push({
            pathname: `/editor/${kind}`,
            params: { id, ...(viaGenreId ? { viaGenreId } : {}) },
          })
        }
        className="min-h-12 flex-row items-center gap-1 px-2 active:opacity-pressed"
      >
        <Icon name="pencil-outline" size={18} tone="textSecondary" />
        <AppText variant="label" tone="textSecondary">
          編集
        </AppText>
      </Pressable>
    </View>
  );
}
