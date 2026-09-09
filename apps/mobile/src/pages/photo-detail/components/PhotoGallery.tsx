import { useCallback, useState } from 'react';
import { FlatList, View, type ViewToken } from 'react-native';
import type { Post } from '../../../features/photos/model/types';
import { PostImage } from '../../../features/photos/ui/PostImage';
import { ZoomPhoto } from './ZoomPhoto';
import { PostVideo } from './PostVideo';

export function PhotoGallery({
  photos,
  activeId,
  stampName,
  scrollEnabled,
  onActiveChange,
  onDisplayed,
  focused = true,
}: {
  photos: Post[];
  activeId: string;
  stampName: string;
  scrollEnabled: boolean;
  onActiveChange: (id: string) => void;
  onDisplayed: (id: string) => void;
  focused?: boolean;
}) {
  const [zoomed, setZoomed] = useState(false);
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
          scrollEnabled={scrollEnabled && !zoomed && photos.length > 1}
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
            <View style={[size, { overflow: 'hidden' }]}>
              {item.mediaType === 'VIDEO' ? (
                item.id === activeId && focused ? (
                  <PostVideo
                    key={item.id}
                    post={item}
                    onDisplayed={() => onDisplayed(item.id)}
                  />
                ) : (
                  <PostImage
                    post={item}
                    variant="large"
                    fit="contain"
                    className="flex-1"
                  />
                )
              ) : (
                <ZoomPhoto
                  post={item}
                  active={item.id === activeId}
                  size={size}
                  label={`${item.author.name ?? '旅の仲間'}が投稿した${stampName}の写真`}
                  onDisplayed={() => onDisplayed(item.id)}
                  onZoomChange={setZoomed}
                />
              )}
            </View>
          )}
        />
      ) : null}
    </View>
  );
}
