import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import type { useTrip } from '../../../features/trips/hooks';
import { AppText } from '../../../shared/ui/AppText';
import { PostImage } from '../../../features/photos/ui/PostImage';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
import { StateView } from '../../../shared/ui/StateView';

export function FavoritePhotosSection({
  favorites,
}: {
  favorites: ReturnType<typeof useTrip>['favorites'];
}) {
  const router = useRouter();
  return (
    <View className="gap-4">
      <View className="px-4">
        <SectionHeading title="お気に入り" count={favorites.length} />
      </View>
      {favorites.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerClassName="gap-3 px-4"
        >
          {favorites.map((photo) => {
            const { categoryName, stampName } = photo;
            return (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                accessibilityLabel={
                  categoryName + '、' + stampName + 'の写真を開く'
                }
                onPress={() =>
                  router.push({
                    pathname: '/trips/photo/[postId]',
                    params: {
                      postId: photo.id,
                      source: 'trip',
                      tripId: photo.tripId,
                    },
                  })
                }
                className="w-[174px] gap-2 active:opacity-pressed"
              >
                <PostImage
                  post={photo}
                  fit="cover"
                  className="aspect-square rounded-2xl"
                />
                <AppText
                  variant="caption"
                  tone="textSecondary"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  accessibilityLabel={categoryName}
                >
                  {categoryName}
                </AppText>
                <AppText
                  variant="label"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  accessibilityLabel={stampName}
                >
                  {stampName}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : (
        <View className="px-4">
          <StateView
            compact
            title="お気に入りを集めよう"
            description="写真をお気に入りにすると、ここに表示されます。"
            icon="heart-outline"
          />
        </View>
      )}
    </View>
  );
}
