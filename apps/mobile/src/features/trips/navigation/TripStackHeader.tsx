import { useNavigation, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useData } from '../../app-data/AppDataProvider';
import type { NotificationTarget } from '../../notifications/model/types';
import { useDetail } from '../../app-data/api/queries';
import type { Genre, Stamp, Trip } from '../model/types';
import { PageHeader, TopHeader } from '../../../shared/ui/Header';
import { resolveApiTarget } from './targets';

export function TripStackHeader({
  name,
  params,
}: {
  name: string;
  params?: { tripId?: string; genreId?: string; stampId?: string };
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const { client, userId } = useData();
  const stamp = useDetail<Stamp>(
    `/stamps/${params?.stampId}`,
    !!params?.stampId,
  ).data;
  const genreId = stamp?.genreId ?? params?.genreId;
  const genre = useDetail<Genre>(`/genres/${genreId}`, !!genreId).data;
  const tripId = genre?.tripId ?? params?.tripId;
  const trip = useDetail<Trip>(`/trips/${tripId}`, !!tripId).data;
  if (name === 'index')
    return <TopHeader onPost={() => router.push('/editor/post')} />;
  const parent: NotificationTarget | undefined =
    stamp && genre
      ? { type: 'genre', genreId: genre.id }
      : genre && trip
        ? { type: 'trip', tripId: trip.id }
        : undefined;
  const title = params?.stampId
    ? (genre?.name ?? 'ジャンル')
    : params?.genreId
      ? (trip?.name ?? '旅行')
      : '一覧';
  return (
    <PageHeader
      title={title}
      onPost={() =>
        router.push({
          pathname: '/editor/post',
          params: {
            initialTripId: tripId,
            initialGenreId: genreId,
            initialStampId: params?.stampId,
          },
        })
      }
      onBack={() => {
        if (navigation.canGoBack()) {
          navigation.goBack();
          return;
        }
        if (!parent) {
          router.dismissTo('/trips');
          return;
        }
        void resolveApiTarget(client, parent)
          .then((routes) => {
            if (client.snapshot().user?.id !== userId) return;
            navigation.dispatch({
              type: 'RESET',
              payload: { index: routes.length - 1, routes },
            });
          })
          .catch((error: Error) =>
            Alert.alert('戻り先を取得できませんでした', error.message),
          );
      }}
    />
  );
}
