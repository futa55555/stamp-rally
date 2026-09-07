import { Pressable, View } from "react-native";
import type { Post } from "../data/types";
import { useData } from "../data/AppDataProvider";
import { useTask } from "../features/hooks";
import { useAppTheme } from "../theme/ThemeProvider";
import { AppText, ErrorMessage, IconButton } from "./ui";
import { PhotoImage } from "./PhotoImage";

export function PhotoTile({
  photo,
  onOpen,
  width,
}: {
  photo: Post;
  onOpen: () => void;
  width?: number;
}) {
  const theme = useAppTheme();
  const { actions } = useData();
  const task = useTask();
  return (
    <View
      style={{
        flex: width ? undefined : 1,
        width,
        gap: theme.spacing.xs,
        minWidth: 0,
      }}
    >
      <View>
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`${photo.author.name ?? "旅の仲間"}の写真を開く`}
          style={({ pressed }) => ({
            opacity: pressed ? theme.opacity.pressed : 1,
          })}
        >
          <PhotoImage
            url={photo.mediaUrl}
            style={{ aspectRatio: 0.92, borderRadius: theme.radius.md }}
          />
        </Pressable>
        <IconButton
          icon={photo.isFavorite ? "star" : "star-outline"}
          label={photo.isFavorite ? "お気に入りを解除" : "お気に入りに追加"}
          selected={photo.isFavorite}
          disabled={task.pending}
          tone={photo.isFavorite ? "favorite" : "text"}
          onPress={() => {
            void task.run(() =>
              actions.setFavorite(photo.id, !photo.isFavorite),
            );
          }}
          style={{
            position: "absolute",
            top: theme.spacing.xs,
            right: theme.spacing.xs,
            backgroundColor: theme.colors.surface,
          }}
        />
      </View>
      <AppText variant="caption" tone="textSecondary" numberOfLines={1}>
        {photo.author.name ?? "旅の仲間"}
      </AppText>
      <ErrorMessage message={task.error} />
    </View>
  );
}
