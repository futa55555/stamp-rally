import { useLocalSearchParams } from 'expo-router';
import type { EntityKind } from '../../features/editor/model/types';
import type { NamedInput, TripInput } from '../../features/trips/model/inputs';
import type { Trip, Genre, Stamp } from '../../features/trips/model/types';
import { useDetail } from '../../features/app-data/api/queries';
import { localDate } from '../../shared/lib/dates';
import { QueryState } from '../../shared/ui/QueryState';
import { EntityForm } from './components/EntityForm';

export function EntityEditorScreen({ kind }: { kind: EntityKind }) {
  const { id, tripId, genreId } = useLocalSearchParams<{
    id?: string;
    tripId?: string;
    genreId?: string;
  }>();
  const path = id
    ? `/${kind}s/${id}`
    : kind === 'genre'
      ? `/trips/${tripId}`
      : `/genres/${genreId}`;
  const enabled = !!id || kind !== 'trip';
  const query = useDetail<Trip | Genre | Stamp>(path, enabled);
  if (query.isPending || (query.error && !query.data))
    return <QueryState query={query} />;
  const initial: TripInput & NamedInput = {
    name: '',
    description: '',
    startDate: localDate(new Date()),
    endDate: localDate(new Date()),
    coverImageUrl: null,
    locations: [],
    ...(id ? query.data : {}),
  };
  return (
    <EntityForm
      key={`${kind}-${id ?? tripId ?? genreId ?? 'new'}`}
      kind={kind}
      id={id}
      tripId={tripId}
      genreId={genreId}
      initial={initial}
      parentLabel={!id ? (query.data?.name ?? '') : ''}
    />
  );
}
