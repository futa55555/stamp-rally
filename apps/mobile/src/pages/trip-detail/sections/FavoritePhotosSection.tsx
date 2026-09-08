import { useRouter } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useData } from '../../../features/app-data/AppDataProvider';
import type { useTrip } from '../../../features/trips/hooks';
import { AppText } from '../../../shared/ui/AppText';
import { PhotoImage } from '../../../shared/ui/PhotoImage';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
import { StateView } from '../../../shared/ui/StateView';

export function FavoritePhotosSection({
  favorites,
}: {
  favorites: ReturnType<typeof useTrip>['favorites'];
}) {
  const router = useRouter();
  const { data } = useData();
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
            const genreName =
              data.genres.find((g) => g.id === photo.genreId)?.name ?? '';
            const stampName =
              data.stamps.find((s) => s.id === photo.stampId)?.name ?? '';
            return (
              <Pressable
                key={photo.id}
                accessibilityRole="button"
                accessibilityLabel={
                  genreName + '、' + stampName + 'の写真を開く'
                }
                onPress={() =>
                  router.push({
                    pathname: '/trips/photo/[postId]',
                    params: { postId: photo.id },
                  })
                }
                className="w-[174px] gap-2 active:opacity-pressed"
              >
                <PhotoImage url={photo.mediaUrl} className="aspect-square" />
                <AppText
                  variant="caption"
                  tone="textSecondary"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  accessibilityLabel={genreName}
                >
                  {genreName}
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
