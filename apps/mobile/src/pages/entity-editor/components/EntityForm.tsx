import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useData } from '../../../features/app-data/AppDataProvider';
import { useEditor } from '../../../features/editor/EditorProvider';
import { useEditorGuard } from '../../../features/editor/hooks/useEditorGuard';
import { selectPostScope } from '../../../features/editor/model/draft';
import type { EntityKind } from '../../../features/editor/model/types';
import { FormPage } from '../../../features/editor/ui/FormPage';
import { usePhotoPicker } from '../../../features/photos/hooks/usePhotoPicker';
import { CoverField } from './CoverField';
import { LocationsField } from './LocationsField';
import type {
  NamedInput,
  TripInput,
} from '../../../features/trips/model/inputs';
import { useTask } from '../../../shared/hooks/useTask';
import { AppText } from '../../../shared/ui/AppText';
import { DateField } from './DateField';
import { TextField } from './TextField';

const labels = { trip: '旅行', genre: 'ジャンル', stamp: 'スタンプ' };

export function EntityForm({
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
  const dirty =
    JSON.stringify(values.locations) !== JSON.stringify(original.locations) ||
    (
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
          locations: values.locations,
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
        hideLabel={kind === 'trip'}
      />
      {kind === 'trip' ? (
        <>
          <DateField
            value={{ startDate: values.startDate, endDate: values.endDate }}
            onChange={(range) => setValues((v) => ({ ...v, ...range }))}
            disabled={pending}
          />
          <LocationsField
            values={values.locations}
            onChange={(locations) => setValues((v) => ({ ...v, locations }))}
            disabled={pending}
          />
          <CoverField
            uri={values.coverImageUrl}
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
