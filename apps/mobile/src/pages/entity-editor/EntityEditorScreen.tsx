import { useLocalSearchParams, useRouter } from 'expo-router';
import { useData } from '../../features/app-data/AppDataProvider';
import type { EntityKind } from '../../features/editor/model/types';
import {
  requireGenreAccess,
  requireStampAccess,
  requireTripAccess,
} from '../../features/trips/model/access';
import type { NamedInput, TripInput } from '../../features/trips/model/inputs';
import { localDate } from '../../shared/lib/dates';
import { StateView } from '../../shared/ui/StateView';
import { EntityForm } from './components/EntityForm';

export function EntityEditorScreen({ kind }: { kind: EntityKind }) {
  const { id, tripId, genreId, fromPost } = useLocalSearchParams<{
    id?: string;
    tripId?: string;
    genreId?: string;
    fromPost?: string;
  }>();
  const { data, userId } = useData();
  const router = useRouter();
  let initial: TripInput & NamedInput = {
    name: '',
    description: '',
    startDate: localDate(new Date()),
    endDate: localDate(new Date()),
    coverImageUrl: null,
  };
  let parentLabel = '';
  try {
    if (kind === 'trip') {
      if (id) initial = { ...initial, ...requireTripAccess(data, userId!, id) };
    } else if (kind === 'genre') {
      if (id)
        initial = { ...initial, ...requireGenreAccess(data, userId!, id) };
      else parentLabel = requireTripAccess(data, userId!, tripId ?? '').name;
    } else {
      if (id)
        initial = {
          ...initial,
          ...requireStampAccess(data, userId!, id).stamp,
        };
      else parentLabel = requireGenreAccess(data, userId!, genreId ?? '').name;
    }
  } catch (error) {
    return (
      <StateView
        title="編集する対象が見つかりません"
        description={error instanceof Error ? error.message : undefined}
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  }
  return (
    <EntityForm
      key={`${kind}-${id ?? tripId ?? genreId ?? 'new'}`}
      kind={kind}
      id={id}
      tripId={tripId}
      genreId={genreId}
      fromPost={fromPost === '1'}
      initial={initial}
      parentLabel={parentLabel}
    />
  );
}
