import { useNavigation, useRouter } from 'expo-router';
import { useData } from '../../app-data/AppDataProvider';
import type { PostScope } from '../../editor/model/draft';
import type { NotificationTarget } from '../../notifications/model/types';
import { PageHeader, TopHeader } from '../../../shared/ui/Header';
import { resolveTarget } from './targets';

export function TripStackHeader({
  name,
  params,
}: {
  name: string;
  params?: { tripId?: string; genreId?: string; stampId?: string };
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const { data, userId } = useData();
  if (name === 'index')
    return <TopHeader onPost={() => router.push('/editor/post')} />;
  const stamp = data.stamps.find((s) => s.id === params?.stampId);
  const genre = data.genres.find(
    (g) => g.id === (stamp?.genreId ?? params?.genreId),
  );
  const trip = data.trips.find(
    (t) => t.id === (genre?.tripId ?? params?.tripId),
  );
  const scope: PostScope = {
    tripId: trip?.id,
    genreId: genre?.id,
    stampId: stamp?.id,
  };
  const parent: NotificationTarget | undefined =
    stamp && genre
      ? { type: 'genre', genreId: genre.id }
      : genre && trip
        ? { type: 'trip', tripId: trip.id }
        : undefined;
  const title = stamp
    ? (genre?.name ?? 'ジャンル')
    : genre
      ? (trip?.name ?? '旅行')
      : '一覧';
  return (
    <PageHeader
      title={title}
      onPost={() => router.push({ pathname: '/editor/post', params: scope })}
      onBack={() => {
        const routes = parent
          ? resolveTarget(data, parent, userId!)
          : [{ name: 'index', params: undefined }];
        if (!routes) {
          router.dismissTo('/trips');
          return;
        }
        const state = navigation.getState();
        const previous = state?.routes[(state?.index ?? 0) - 1];
        const target = routes.at(-1)!;
        if (
          previous?.name === target.name &&
          JSON.stringify(previous.params ?? {}) ===
            JSON.stringify(target.params ?? {})
        )
          navigation.goBack();
        else
          navigation.dispatch({
            type: 'RESET',
            payload: { index: routes.length - 1, routes },
          });
      }}
    />
  );
}
