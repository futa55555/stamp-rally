import { useCoverUpload } from '../../../features/trip-covers/useCoverUpload';
import { useState } from 'react';
import type { NotificationTarget } from '../../../features/notifications/model/types';
import { useData } from '../../../features/app-data/AppDataProvider';
import { useEditor } from '../../../features/editor/EditorProvider';
import { useEditorGuard } from '../../../features/editor/hooks/useEditorGuard';
import type { EntityKind } from '../../../features/editor/model/types';
import { FormPage } from '../../../features/editor/ui/FormPage';
import { CoverField } from './CoverField';
import { LocationsField } from './LocationsField';
import type {
  NamedInput,
  TripInput,
  TripFormValues,
} from '../../../features/trips/model/inputs';
import { useTask } from '../../../shared/hooks/useTask';
import { AppText } from '../../../shared/ui/AppText';
import { DateField } from './DateField';
import { TextField } from './TextField';
import { validateTripInput } from '../../../features/trips/model/validation';

const labels = { trip: '旅行', genre: 'ジャンル', stamp: 'スタンプ' };

export function EntityForm({
  kind,
  id,
  tripId,
  genreId,
  initial,
  parentLabel,
}: {
  kind: EntityKind;
  id?: string;
  tripId?: string;
  genreId?: string;
  initial: TripFormValues & NamedInput;
  parentLabel: string;
}) {
  const { actions, userId } = useData();
  const flow = useEditor();
  const [original] = useState(initial);
  const [savedTarget, setSavedTarget] = useState<NotificationTarget | null>(
    null,
  );
  const [values, setValues] = useState(initial);
  const task = useTask();
  const [coverPicking, setCoverPicking] = useState(false);
  const cover = useCoverUpload(initial.coverImageUrl);
  const pending = task.pending || flow.finishing || coverPicking;
  const dirty =
    !savedTarget &&
    (cover.changed ||
      JSON.stringify(values.locations) !== JSON.stringify(original.locations) ||
      (
        [
          'name',
          'description',
          'startDate',
          'endDate',
          'coverImageUrl',
        ] as const
      ).some((key) => values[key] !== original[key]));
  useEditorGuard(dirty, pending);
  const save = () => {
    if (coverPicking) return;
    void task
      .run(async () => {
        if (savedTarget) {
          await flow.finish({ target: savedTarget });
          return;
        }
        let target: NotificationTarget;
        if (kind === 'trip') {
          const input: TripInput = validateTripInput({
            name: values.name,
            startDate: values.startDate,
            endDate: values.endDate,
            locations: values.locations,
          });
          Object.assign(input, await cover.prepare());
          const trip = id
            ? await actions.updateTrip(userId!, id, input)
            : await actions.createTrip(userId!, {
                ...input,
                clientRequestId: cover.requestId,
              });
          cover.saved();
          target = { type: 'trip', tripId: trip.id };
        } else if (kind === 'genre') {
          const input = { name: values.name, description: values.description };
          const genre = id
            ? await actions.updateGenre(userId!, id, input)
            : await actions.createGenre(userId!, { ...input, tripId: tripId! });
          target = { type: 'genre', genreId: genre.id };
        } else {
          const input = { name: values.name, description: values.description };
          const stamp = id
            ? await actions.updateStamp(userId!, id, input)
            : await actions.createStamp(userId!, {
                ...input,
                genreId: genreId!,
              });
          target = { type: 'stamp', stampId: stamp.id };
        }
        // A failed ancestor fetch can be retried without creating the entity twice.
        setSavedTarget(target);
        await flow.finish({ target });
      })
      .finally(cover.finish);
  };
  return (
    <FormPage
      title={`${labels[kind]}を${id ? '編集' : '作成'}`}
      pending={pending}
      error={task.error}
      onSave={save}
      saveLabel={
        coverPicking
          ? '画像を準備中…'
          : pending && cover.message
            ? cover.message
            : savedTarget
              ? '保存した画面を開く'
              : id
                ? '変更を保存'
                : '作成する'
      }
    >
      {parentLabel ? <AppText tone="primary">{parentLabel}</AppText> : null}
      <TextField
        label={`${labels[kind]}の名前`}
        value={values.name}
        onChangeText={(name) => setValues((v) => ({ ...v, name }))}
        disabled={pending || !!savedTarget}
        hint="1〜100文字"
        hideLabel={kind === 'trip'}
      />
      {kind === 'trip' ? (
        <>
          <DateField
            value={{ startDate: values.startDate, endDate: values.endDate }}
            onChange={(range) => setValues((v) => ({ ...v, ...range }))}
            disabled={pending || !!savedTarget}
          />
          <LocationsField
            values={values.locations}
            onChange={(locations) => setValues((v) => ({ ...v, locations }))}
            disabled={pending || !!savedTarget}
          />
          <CoverField
            uri={cover.uri}
            tripId={id}
            onSelect={cover.select}
            onRemove={cover.remove}
            onPendingChange={setCoverPicking}
            disabled={pending || !!savedTarget}
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
          disabled={pending || !!savedTarget}
          hint="2,000文字以内"
        />
      )}
    </FormPage>
  );
}
