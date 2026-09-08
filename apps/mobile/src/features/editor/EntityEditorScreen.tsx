import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, StateView } from '../../components/ui';
import { useData } from '../../data/AppDataProvider';
import { localDate } from '../../data/dates';
import {
  requireGenreAccess,
  requireStampAccess,
  requireTripAccess,
  type TripInput,
  type NamedInput,
} from '../../data/mutations';
import { useTask } from '../hooks';
import { useEditor } from './EditorProvider';
import { DateField, FormPage, TextField, useEditorGuard } from './form';
import { PhotoField, usePhotoPicker } from './photos';
import { selectPostScope } from './draft';

export type EntityKind = 'trip' | 'genre' | 'stamp';
const labels = { trip: '旅行', genre: 'ジャンル', stamp: 'スタンプ' };

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

function EntityForm({
  kind,
  id,
  tripId,
  genreId,
  fromPost,
  initial,
  parentLabel,
}: {
  kind: EntityKind;
  id?: string;
  tripId?: string;
  genreId?: string;
  fromPost: boolean;
  initial: TripInput & NamedInput;
  parentLabel: string;
}) {
  const { actions, userId } = useData();
  const router = useRouter();
  const flow = useEditor();
  const [original] = useState(initial);
  const [values, setValues] = useState(initial);
  const task = useTask();
  const picker = usePhotoPicker(
    (uris) => setValues((v) => ({ ...v, coverImageUrl: uris[0] })),
    1,
  );
  const pending = task.pending || picker.pending || flow.finishing;
  const dirty = (
    ['name', 'description', 'startDate', 'endDate', 'coverImageUrl'] as const
  ).some((key) => values[key] !== original[key]);
  const leave = useEditorGuard(dirty, pending);
  const save = () => {
    void task.run(async () => {
      if (kind === 'trip') {
        const input: TripInput = {
          name: values.name,
          startDate: values.startDate,
          endDate: values.endDate,
          coverImageUrl: values.coverImageUrl,
        };
        const trip = id
          ? await actions.updateTrip(userId!, id, input)
          : await actions.createTrip(userId!, input);
        flow.finish(id ? {} : { target: { type: 'trip', tripId: trip.id } });
      } else if (kind === 'genre') {
        const input = { name: values.name, description: values.description };
        const genre = id
          ? await actions.updateGenre(userId!, id, input)
          : await actions.createGenre(userId!, { ...input, tripId: tripId! });
        if (fromPost && flow.draft && flow.draft.tripId === genre.tripId) {
          flow.setDraft((draft) =>
            draft ? selectPostScope(draft, 'genreId', genre.id) : draft,
          );
          leave(() => router.back());
        } else
          flow.finish(
            id ? {} : { target: { type: 'genre', genreId: genre.id } },
          );
      } else {
        const input = { name: values.name, description: values.description };
        const stamp = id
          ? await actions.updateStamp(userId!, id, input)
          : await actions.createStamp(userId!, { ...input, genreId: genreId! });
        if (fromPost && flow.draft && flow.draft.genreId === stamp.genreId) {
          flow.setDraft((draft) =>
            draft ? selectPostScope(draft, 'stampId', stamp.id) : draft,
          );
          leave(() => router.back());
        } else
          flow.finish(
            id ? {} : { target: { type: 'stamp', stampId: stamp.id } },
          );
      }
    });
  };
  return (
    <FormPage
      title={`${labels[kind]}を${id ? '編集' : '作成'}`}
      pending={pending}
      error={task.error ?? picker.error}
      onSave={save}
      saveLabel={id ? '変更を保存' : '作成する'}
    >
      {parentLabel ? <AppText tone="primary">{parentLabel}</AppText> : null}
      <TextField
        label={`${labels[kind]}の名前`}
        value={values.name}
        onChangeText={(name) => setValues((v) => ({ ...v, name }))}
        disabled={pending}
        hint="1〜100文字"
      />
      {kind === 'trip' ? (
        <>
          <DateField
            label="開始日"
            value={values.startDate}
            onChange={(startDate) => setValues((v) => ({ ...v, startDate }))}
            disabled={pending}
          />
          <DateField
            label="終了日"
            value={values.endDate}
            onChange={(endDate) => setValues((v) => ({ ...v, endDate }))}
            disabled={pending}
          />
          <PhotoField
            label="カバー写真（任意）"
            uris={values.coverImageUrl ? [values.coverImageUrl] : []}
            max={1}
            onRemove={() => setValues((v) => ({ ...v, coverImageUrl: null }))}
            picker={picker}
            disabled={pending}
          />
        </>
      ) : (
        <TextField
          label="説明（任意）"
          value={values.description}
          onChangeText={(description) =>
            setValues((v) => ({ ...v, description }))
          }
          multiline
          disabled={pending}
          hint="2,000文字以内"
        />
      )}
      {fromPost ? (
        <AppText variant="caption" tone="textMuted">
          作成後は投稿に戻ります。作成した項目は、投稿をキャンセルしても残ります。
        </AppText>
      ) : null}
    </FormPage>
  );
}
