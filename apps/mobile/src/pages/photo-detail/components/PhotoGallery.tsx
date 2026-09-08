import { useCallback, useState } from 'react';
import { FlatList, View, type ViewToken } from 'react-native';
import type { Post } from '../../../features/photos/model/types';
import { PhotoImage } from '../../../shared/ui/PhotoImage';

export function PhotoGallery({
  photos,
  activeId,
  stampName,
  scrollEnabled,
  onActiveChange,
  onDisplayed,
}: {
  photos: Post[];
  activeId: string;
  stampName: string;
  scrollEnabled: boolean;
  onActiveChange: (id: string) => void;
  onDisplayed: (id: string) => void;
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewabilityConfig] = useState({ itemVisiblePercentThreshold: 95 });
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken<Post>[] }) => {
      const visible = viewableItems.find((item) => item.isViewable);
      if (visible) onActiveChange(visible.item.id);
    },
    [onActiveChange],
  );

  return (
    <View
      className="flex-1"
      onLayout={({ nativeEvent: { layout } }) =>
        setSize((previous) =>
          previous.width === layout.width && previous.height === layout.height
            ? previous
            : { width: layout.width, height: layout.height },
        )
      }
    >
      {size.width > 0 && size.height > 0 ? (
        <FlatList
          key={size.width}
          data={photos}
          horizontal
          pagingEnabled
          bounces={false}
          scrollEnabled={scrollEnabled && photos.length > 1}
          showsHorizontalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          className="flex-1"
          initialScrollIndex={Math.max(
            0,
            photos.findIndex((photo) => photo.id === activeId),
          )}
          getItemLayout={(_, index) => ({
            length: size.width,
            offset: size.width * index,
            index,
          })}
          keyExtractor={(photo) => photo.id}
          initialNumToRender={1}
          maxToRenderPerBatch={3}
          windowSize={3}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          renderItem={({ item }) => (
            <View style={size}>
              <PhotoImage
                url={item.mediaUrl}
                label={`${item.author.name ?? '旅の仲間'}が投稿した${stampName}の写真`}
                fit="contain"
                background="background"
                className="flex-1"
                onDisplayed={() => onDisplayed(item.id)}
              />
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
