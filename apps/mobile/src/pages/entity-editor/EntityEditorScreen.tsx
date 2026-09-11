import { useLocalSearchParams } from 'expo-router';
import type { EntityKind } from '../../features/editor/model/types';
import type {
  NamedInput,
  TripFormValues,
} from '../../features/trips/model/inputs';
import type { Trip, Genre, Stamp } from '../../features/trips/model/types';
import { useDetail } from '../../features/app-data/api/queries';
import { localDate } from '../../shared/lib/dates';
import { QueryState } from '../../shared/ui/QueryState';
import { EntityForm } from './components/EntityForm';

export function EntityEditorScreen({ kind }: { kind: EntityKind }) {
  const { id, tripId, genreId, viaGenreId } = useLocalSearchParams<{
    id?: string;
    tripId?: string;
    genreId?: string;
    viaGenreId?: string;
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
  const initial: TripFormValues & NamedInput & { genreIds?: string[] } = {
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
      tripId={
        kind === 'stamp'
          ? (query.data as Genre | Stamp | undefined)?.tripId
          : tripId
      }
      genreId={genreId}
      viaGenreId={viaGenreId ?? genreId}
      initial={initial}
      parentLabel={!id ? (query.data?.name ?? '') : ''}
    />
  );
}
