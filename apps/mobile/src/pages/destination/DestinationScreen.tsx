import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useData } from '../../features/app-data/AppDataProvider';
import { useEditor } from '../../features/editor/EditorProvider';
import { selectPostScope } from '../../features/editor/model/draft';
import { sortTrips } from '../../features/trips/model/selectors';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { Button } from '../../shared/ui/Button';
import { Header } from '../../shared/ui/Header';
import { Icon } from '../../shared/ui/Icon';
import { ListRow } from '../../shared/ui/ListRow';
import { StateView } from '../../shared/ui/StateView';

export function DestinationScreen() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const flow = useEditor();
  const { data, userId } = useData();
  const router = useRouter();
  const theme = useAppTheme();
  const draft = flow.draft;
  if (
    !draft ||
    (field !== 'tripId' && field !== 'genreId' && field !== 'stampId')
  )
    return (
      <StateView
        title="投稿画面から選び直してください"
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  const accessible = new Set(
    data.memberships.filter((m) => m.userId === userId).map((m) => m.tripId),
  );
  const parentAccessible = accessible.has(draft.tripId ?? '');
  const genre = data.genres.find(
    (g) => g.id === draft.genreId && g.tripId === draft.tripId,
  );
  const items =
    field === 'tripId'
      ? sortTrips(data.trips.filter((t) => accessible.has(t.id)))
      : field === 'genreId'
        ? data.genres.filter(
            (g) => parentAccessible && g.tripId === draft.tripId,
          )
        : data.stamps.filter(
            (s) => parentAccessible && genre && s.genreId === genre.id,
          );
  const label =
    field === 'tripId' ? '旅行' : field === 'genreId' ? 'ジャンル' : 'スタンプ';
  const canCreate =
    field === 'genreId'
      ? parentAccessible
      : field === 'stampId' && parentAccessible && !!genre;
  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ flex: 1, backgroundColor: theme.colors.background }}
    >
      <Header title={`${label}を選択`} onBack={() => router.back()} />
      <FlatList<{ id: string; name: string }>
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          padding: theme.spacing.lg,
          gap: theme.spacing.sm,
        }}
        ListEmptyComponent={
          <StateView
            compact
            title={`まだ${label}がありません`}
            description={
              canCreate
                ? '下のボタンから作成できます。'
                : '旅行一覧から旅行を作成してください。'
            }
          />
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            icon={
              field === 'tripId'
                ? 'bag-suitcase-outline'
                : field === 'genreId'
                  ? 'compass-outline'
                  : 'postage-stamp'
            }
            trailing={
              draft[field] === item.id ? (
                <Icon name="check" tone="primary" />
              ) : undefined
            }
            onPress={() => {
              flow.setDraft((current) =>
                current ? selectPostScope(current, field, item.id) : current,
              );
              router.back();
            }}
          />
        )}
      />
      {canCreate ? (
        <View style={{ padding: theme.spacing.md }}>
          <Button
            label={`${label}を新規作成`}
            icon="plus"
            onPress={() => {
              if (field === 'genreId')
                router.replace({
                  pathname: '/editor/genre',
                  params: { tripId: draft.tripId!, fromPost: '1' },
                });
              else
                router.replace({
                  pathname: '/editor/stamp',
                  params: { genreId: draft.genreId!, fromPost: '1' },
                });
            }}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
