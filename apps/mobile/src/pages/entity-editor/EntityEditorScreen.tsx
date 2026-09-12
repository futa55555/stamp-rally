import { useLocalSearchParams } from 'expo-router';
import type { EntityKind } from '../../features/editor/model/types';
import type {
  NamedInput,
  TripFormValues,
} from '../../features/trips/model/inputs';
import type { Trip, Category, Stamp } from '../../features/trips/model/types';
import { useDetail } from '../../features/app-data/api/queries';
import { localDate } from '../../shared/lib/dates';
import { QueryState } from '../../shared/ui/QueryState';
import { EntityForm } from './components/EntityForm';

export function EntityEditorScreen({ kind }: { kind: EntityKind }) {
  const { id, tripId, categoryId, viaCategoryId } = useLocalSearchParams<{
    id?: string;
    tripId?: string;
    categoryId?: string;
    viaCategoryId?: string;
  }>();
  const path = id
    ? `/${kind === 'category' ? 'categories' : `${kind}s`}/${id}`
    : kind === 'category'
      ? `/trips/${tripId}`
      : `/categories/${categoryId}`;
  const enabled = !!id || kind !== 'trip';
  const query = useDetail<Trip | Category | Stamp>(path, enabled);
  if (query.isPending || (query.error && !query.data))
    return <QueryState query={query} />;
  const initial: TripFormValues & NamedInput & { categoryIds?: string[] } = {
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
      key={`${kind}-${id ?? tripId ?? categoryId ?? 'new'}`}
      kind={kind}
      id={id}
      tripId={
        kind === 'stamp' || (kind === 'category' && !!id)
          ? (query.data as Category | Stamp | undefined)?.tripId
          : tripId
      }
      categoryId={categoryId}
      viaCategoryId={viaCategoryId ?? categoryId}
      initial={initial}
      parentLabel={!id ? (query.data?.name ?? '') : ''}
    />
  );
}
