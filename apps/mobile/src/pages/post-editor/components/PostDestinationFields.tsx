import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { useData } from '../../../features/app-data/AppDataProvider';
import type {
  PostDraft,
  PostScope,
} from '../../../features/editor/model/draft';
import { sortTrips } from '../../../features/trips/model/selectors';
import { AppText } from '../../../shared/ui/AppText';
import { SelectField } from '../../../shared/ui/SelectField';

export function PostDestinationFields({
  draft,
  disabled,
  onChange,
}: {
  draft: PostDraft;
  disabled: boolean;
  onChange: (field: keyof PostScope, id: string) => void;
}) {
  const { data, userId } = useData();
  const router = useRouter();
  const accessible = new Set(
    data.memberships
      .filter((member) => member.userId === userId)
      .map((member) => member.tripId),
  );
  const trips = sortTrips(data.trips.filter((trip) => accessible.has(trip.id)));
  const trip = trips.find((item) => item.id === draft.tripId);
  const genres = data.genres.filter(
    (genre) => trip && genre.tripId === trip.id,
  );
  const genre = genres.find((item) => item.id === draft.genreId);
  const stamps = data.stamps.filter(
    (stamp) => genre && stamp.genreId === genre.id,
  );
  const options = (items: { id: string; name: string }[]) =>
    items.map((item) => ({ value: item.id, label: item.name }));

  return (
    <View className="gap-3">
      <AppText variant="heading">投稿先</AppText>
      <View className="overflow-hidden rounded-2xl bg-surface">
        <SelectField
          label="旅行"
          icon="bag-suitcase-outline"
          value={draft.tripId}
          placeholder={
            trips.length ? '旅行を選択' : '参加している旅行がありません'
          }
          options={options(trips)}
          disabled={disabled}
          onChange={(id) => onChange('tripId', id)}
        />
        <View className="mx-4 h-px bg-border" />
        <SelectField
          label="ジャンル"
          icon="compass-outline"
          value={draft.genreId}
          placeholder={
            trip ? 'ジャンルを選択・作成' : '先に旅行を選択してください'
          }
          options={options(genres)}
          disabled={disabled || !trip}
          onChange={(id) => onChange('genreId', id)}
          create={
            trip
              ? {
                  label: 'ジャンルを新規作成',
                  onPress: () =>
                    router.push({
                      pathname: '/editor/genre',
                      params: { tripId: trip.id, fromPost: '1' },
                    }),
                }
              : undefined
          }
        />
        <View className="mx-4 h-px bg-border" />
        <SelectField
          label="スタンプ"
          icon="postage-stamp"
          value={draft.stampId}
          placeholder={
            genre ? 'スタンプを選択・作成' : '先にジャンルを選択してください'
          }
          options={options(stamps)}
          disabled={disabled || !genre}
          onChange={(id) => onChange('stampId', id)}
          create={
            genre
              ? {
                  label: 'スタンプを新規作成',
                  onPress: () =>
                    router.push({
                      pathname: '/editor/stamp',
                      params: { genreId: genre.id, fromPost: '1' },
                    }),
                }
              : undefined
          }
        />
      </View>
      {!trips.length ? (
        <AppText variant="caption" tone="textSecondary">
          旅行一覧から旅行を作成してください。
        </AppText>
      ) : null}
    </View>
  );
}
