import { Stack, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { AppText } from '../../../shared/ui/AppText';
import { Button } from '../../../shared/ui/Button';
import { Icon } from '../../../shared/ui/Icon';
import type { PostScope } from '../model/draft';
import type { EntityKind } from '../model/types';

export function PostAction({ scope }: { scope: PostScope }) {
  const router = useRouter();
  return (
    <Stack.Screen
      options={{
        headerRight: () => (
          <Button
            label="投稿"
            icon="camera-plus-outline"
            onPress={() =>
              router.push({ pathname: '/editor/post', params: scope })
            }
          />
        ),
      }}
    />
  );
}

export function EditableTitle({
  title,
  kind,
  id,
}: {
  title: string;
  kind: EntityKind;
  id: string;
}) {
  const router = useRouter();
  const theme = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
      }}
    >
      <AppText
        variant="title"
        accessibilityRole="header"
        style={{ flex: 1, paddingVertical: theme.spacing.xs }}
      >
        {title}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="編集"
        onPress={() =>
          router.push({ pathname: `/editor/${kind}`, params: { id } })
        }
        style={({ pressed }) => ({
          minHeight: theme.layout.touchTarget,
          paddingHorizontal: theme.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.xxs,
          opacity: pressed ? theme.opacity.pressed : 1,
        })}
      >
        <Icon name="pencil-outline" size={18} tone="textSecondary" />
        <AppText variant="label" tone="textSecondary">
          編集
        </AppText>
      </Pressable>
    </View>
  );
}
