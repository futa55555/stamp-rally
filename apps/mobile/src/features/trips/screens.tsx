import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useGenre, useStamp, useToday, useTrip, useTrips } from '../hooks';
import { useAppTheme } from '../../theme/ThemeProvider';
import {
  AppText,
  Badge,
  Icon,
  ListRow,
  Progress,
  Screen,
  SectionHeading,
  StateView,
} from '../../components/ui';
import { PhotoImage } from '../../components/PhotoImage';
import { PhotoTile } from '../../components/PhotoTile';
import { dateRange } from '../../data/dates';
import { isActiveTrip } from '../../data/selectors';

export function TripListScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { trips, today } = useTrips();
  return (
    <FlatList
      data={trips}
      keyExtractor={(trip) => trip.id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.lg,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.xs, marginBottom: theme.spacing.xs }}>
          <AppText variant="eyebrow" tone="primary">
            YOUR TRAVEL JOURNAL
          </AppText>
          <AppText variant="hero" accessibilityRole="header">
            次の思い出を、{'\n'}ここに。
          </AppText>
          <AppText tone="textSecondary">
            いつもの仲間と、まだ知らない景色へ。
          </AppText>
          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionHeading title="あなたの旅行" count={trips.length} />
          </View>
        </View>
      }
      ListEmptyComponent={
        <StateView
          title="まだ旅行がありません"
          description="参加した旅行がここに表示されます。"
          icon="bag-suitcase-outline"
          compact
        />
      }
      renderItem={({ item: trip }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${trip.name}、${isActiveTrip(trip, today) ? '旅行中、' : ''}${dateRange(trip.startDate, trip.endDate)}`}
          onPress={() =>
            router.push({
              pathname: '/trips/trip/[tripId]',
              params: { tripId: trip.id },
            })
          }
          style={({ pressed }) => ({
            backgroundColor: theme.colors.surface,
            borderRadius: theme.radius.lg,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: theme.colors.border,
            opacity: pressed ? theme.opacity.pressed : 1,
          })}
        >
          <View>
            <PhotoImage url={trip.coverImageUrl} style={{ height: 204 }} />
            <View
              style={{
                position: 'absolute',
                left: theme.spacing.md,
                top: theme.spacing.md,
              }}
            >
              <Badge
                label={
                  isActiveTrip(trip, today)
                    ? '旅行中'
                    : trip.startDate > today
                      ? 'これからの旅'
                      : '旅の思い出'
                }
                icon={
                  isActiveTrip(trip, today)
                    ? 'circle-small'
                    : 'calendar-blank-outline'
                }
                kind={isActiveTrip(trip, today) ? 'active' : 'neutral'}
              />
            </View>
          </View>
          <View style={{ padding: theme.spacing.md, gap: theme.spacing.sm }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
              }}
            >
              <AppText variant="heading" style={{ flex: 1 }}>
                {trip.name}
              </AppText>
              <Icon name="arrow-top-right" size={22} tone="primary" />
            </View>
            <AppText variant="caption" tone="textSecondary">
              {dateRange(trip.startDate, trip.endDate)}
            </AppText>
            <Progress
              completed={trip.completedGenreCount}
              total={trip.totalGenreCount}
              label="ジャンル達成"
            />
          </View>
        </Pressable>
      )}
    />
  );
}

export function TripDetailScreen() {
  const router = useRouter();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const theme = useAppTheme();
  const { trip, genres, favorites, members } = useTrip(tripId);
  const today = useToday();
  if (!trip)
    return (
      <StateView
        title="旅行が見つかりません"
        description="旅行一覧から選び直してください。"
        action={{
          label: '旅行一覧へ',
          onPress: () => router.dismissTo('/trips'),
        }}
      />
    );
  return (
    <Screen>
      <View style={{ gap: theme.spacing.md }}>
        <PhotoImage
          url={trip.coverImageUrl}
          label={trip.name}
          style={{ height: 230, borderRadius: theme.radius.lg }}
        />
        {isActiveTrip(trip, today) ? (
          <Badge label="旅行中" icon="circle-small" />
        ) : null}
        <AppText variant="title" accessibilityRole="header">
          {trip.name}
        </AppText>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <Icon name="calendar-blank-outline" size={17} />
          <AppText variant="caption" tone="textSecondary" style={{ flex: 1 }}>
            {dateRange(trip.startDate, trip.endDate)}
          </AppText>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing.xs,
          }}
        >
          <Icon name="account-group-outline" size={18} />
          <AppText variant="caption" tone="textSecondary" style={{ flex: 1 }}>
            {members.map((u) => u.name ?? '旅の仲間').join('・')}
          </AppText>
        </View>
        <Progress
          completed={trip.completedGenreCount}
          total={trip.totalGenreCount}
          label="旅の達成状況"
        />
      </View>
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
      <View style={{ gap: theme.spacing.sm }}>
        <SectionHeading
          title="ジャンル"
          subtitle="小さな寄り道を、ひとつずつ。"
          count={genres.length}
        />
        {genres.map((genre) => (
          <ListRow
            key={genre.id}
            title={genre.name}
            subtitle={`${genre.completedStampCount} / ${genre.totalStampCount} スタンプ達成`}
            icon="compass-outline"
            completed={genre.isCompleted}
            unread={genre.unread}
            onPress={() =>
              router.push({
                pathname: '/trips/genre/[genreId]',
                params: { genreId: genre.id },
              })
            }
          />
        ))}
        {!genres.length ? (
          <StateView
            compact
            title="旅の楽しみは、これから"
            description="ジャンルが追加されると、ここに表示されます。"
            icon="compass-outline"
          />
        ) : null}
      </View>
    </Screen>
  );
}

export function GenreDetailScreen() {
  const router = useRouter();
  const { genreId } = useLocalSearchParams<{ genreId: string }>();
  const theme = useAppTheme();
  const { genre, stamps } = useGenre(genreId);
  if (!genre)
    return (
      <StateView
        title="ジャンルが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <FlatList
      data={stamps}
      keyExtractor={(stamp) => stamp.id}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.sm,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
        flexGrow: 1,
      }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <AppText variant="eyebrow" tone="primary">
            EXPLORE & COLLECT
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {genre.name}
          </AppText>
          <AppText tone="textSecondary">{genre.description}</AppText>
          <Progress
            completed={genre.completedStampCount}
            total={genre.totalStampCount}
            label="スタンプ達成"
          />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionHeading
              title="このジャンルのスタンプ"
              count={stamps.length}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <StateView
          compact
          title="まだスタンプがありません"
          description="新しい発見を楽しみに。"
          icon="postage-stamp"
        />
      }
      renderItem={({ item }) => (
        <ListRow
          title={item.name}
          subtitle={
            item.isCompleted
              ? `${item.photoCount}枚の写真 · 達成済み`
              : 'まだ写真がありません'
          }
          icon="postage-stamp"
          completed={item.isCompleted}
          unread={item.unread}
          onPress={() =>
            router.push({
              pathname: '/trips/stamp/[stampId]',
              params: { stampId: item.id },
            })
          }
        />
      )}
    />
  );
}

export function StampDetailScreen() {
  const router = useRouter();
  const { stampId } = useLocalSearchParams<{ stampId: string }>();
  const theme = useAppTheme();
  const { stamp, genre, photos } = useStamp(stampId);
  if (!stamp)
    return (
      <StateView
        title="スタンプが見つかりません"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return (
    <FlatList
      data={photos.length % 2 ? [...photos, null] : photos}
      numColumns={2}
      keyExtractor={(photo) => photo?.id ?? 'empty-cell'}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      contentContainerStyle={{
        padding: theme.spacing.lg,
        paddingBottom: theme.spacing.xxl,
        gap: theme.spacing.md,
        width: '100%',
        maxWidth: theme.layout.pageMaxWidth,
        alignSelf: 'center',
        flexGrow: 1,
      }}
      columnWrapperStyle={{ gap: theme.spacing.sm }}
      ListHeaderComponent={
        <View style={{ gap: theme.spacing.md, marginBottom: theme.spacing.sm }}>
          <AppText variant="caption" tone="primary">
            {genre?.name}
          </AppText>
          <AppText variant="title" accessibilityRole="header">
            {stamp.name}
          </AppText>
          <AppText tone="textSecondary">{stamp.description}</AppText>
          <Badge
            label={stamp.isCompleted ? 'スタンプ達成' : 'これからのお楽しみ'}
            icon={stamp.isCompleted ? 'check-circle-outline' : 'postage-stamp'}
            kind={stamp.isCompleted ? 'active' : 'neutral'}
          />
          <View style={{ marginTop: theme.spacing.lg }}>
            <SectionHeading
              title="みんなの写真"
              subtitle="星を押して、お気に入りの一枚に。"
              count={photos.length}
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        <StateView
          compact
          title="最初の一枚を楽しみに"
          description="このスタンプに投稿された写真が表示されます。"
          icon="camera-outline"
        />
      }
      renderItem={({ item }) =>
        item ? (
          <PhotoTile
            photo={item}
            onOpen={() =>
              router.push({
                pathname: '/trips/photo/[postId]',
                params: { postId: item.id },
              })
            }
          />
        ) : (
          <View style={{ flex: 1 }} />
        )
      }
    />
  );
}
