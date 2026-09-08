import { useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { PhotoTile } from '../../../features/photos/ui/PhotoTile';
import type { useTrip } from '../../../features/trips/hooks';
import { useAppTheme } from '../../../shared/theme/ThemeProvider';
import { SectionHeading } from '../../../shared/ui/SectionHeading';
import { StateView } from '../../../shared/ui/StateView';

export function FavoritePhotosSection({
  favorites,
}: {
  favorites: ReturnType<typeof useTrip>['favorites'];
}) {
  const theme = useAppTheme();
  const router = useRouter();
  return (
    <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.xs }}>
      <SectionHeading
        title="お気に入りの瞬間"
        subtitle="みんなで選んだ、旅のハイライト"
        count={favorites.length}
      />
      {favorites.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            gap: theme.spacing.sm,
            paddingRight: theme.spacing.xs,
          }}
        >
          {favorites.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              width={174}
              onOpen={() =>
                router.push({
                  pathname: '/trips/photo/[postId]',
                  params: { postId: photo.id },
                })
              }
            />
          ))}
        </ScrollView>
      ) : (
        <StateView
          compact
          title="お気に入りを集めよう"
          description="写真の星を押すと、ここに表示されます。"
          icon="star-outline"
        />
      )}
    </View>
  );
}
