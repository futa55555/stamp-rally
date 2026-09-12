import { Alert } from 'react-native';
import { Button } from '../../../shared/ui/Button';
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
import {
  normalizeLocations,
  validateDomainName,
  validateTripInput,
} from '../../../features/trips/model/validation';
import { useTripTemplates } from '../../../features/trip-templates/useTripTemplates';
import { selectedCategories } from '../../../features/trip-templates/selection';
import { ActivitiesField, TemplateCandidatesField } from './TemplateFields';
import { useList } from '../../../features/app-data/api/queries';
import type { Category } from '../../../features/trips/model/types';
import { StampCategoriesField } from './StampCategoriesField';

const labels = { trip: '旅行', category: 'カテゴリー', stamp: 'スタンプ' };

export function EntityForm({
  kind,
  id,
  tripId,
  categoryId,
  viaCategoryId,
  initial,
  parentLabel,
}: {
  kind: EntityKind;
  id?: string;
  tripId?: string;
  categoryId?: string;
  viaCategoryId?: string;
  initial: TripFormValues & NamedInput & { categoryIds?: string[] };
  parentLabel: string;
}) {
  const { actions, userId } = useData();
  const flow = useEditor();
  const [original] = useState(initial);
  const [savedTarget, setSavedTarget] = useState<NotificationTarget | null>(
    null,
  );
  const [deleted, setDeleted] = useState(false);
  const [values, setValues] = useState(initial);
  const [originalCategoryIds] = useState(
    initial.categoryIds ?? (categoryId ? [categoryId] : []),
  );
  const [categoryIds, setCategoryIds] = useState(originalCategoryIds);
  const categories = useList<Category>(
    '/categories',
    { tripId },
    kind === 'stamp' && !!tripId,
  );
  const newTrip = kind === 'trip' && !id;
  const [activityPresets, setActivityPresets] = useState<string[]>([]);
  const [customActivities, setCustomActivities] = useState<string[]>([]);
  const [useTemplate, setUseTemplate] = useState(true);
  const templates = useTripTemplates(
    newTrip,
    values.locations,
    activityPresets,
  );
  const task = useTask();
  const [coverPicking, setCoverPicking] = useState(false);
  const cover = useCoverUpload(initial.coverImageUrl);
  const pending = task.pending || flow.finishing || coverPicking;
  const dirty =
    !deleted &&
    !savedTarget &&
    (cover.changed ||
      (kind === 'stamp' &&
        (categoryIds.length !== originalCategoryIds.length ||
          categoryIds.some((id) => !originalCategoryIds.includes(id)))) ||
      (newTrip &&
        (activityPresets.length > 0 ||
          customActivities.some(Boolean) ||
          !useTemplate ||
          Object.values(templates.selection).some((checked) => !checked))) ||
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
  const finishDeletion = () =>
    flow.finish(
      kind === 'trip'
        ? { tripList: true }
        : kind === 'category'
          ? { target: { type: 'trip', tripId: tripId! } }
          : {
              target: {
                type: 'category',
                categoryId: originalCategoryIds.includes(viaCategoryId ?? '')
                  ? viaCategoryId!
                  : originalCategoryIds[0],
              },
            },
    );
  const remove = () => {
    if (!id || pending || savedTarget) return;
    const run = () =>
      void task.run(async () => {
        if (!deleted) {
          const operation =
            kind === 'trip'
              ? actions.deleteTrip
              : kind === 'category'
                ? actions.deleteCategory
                : actions.deleteStamp;
          await operation(userId!, id);
          setDeleted(true);
        }
        await finishDeletion();
      });
    if (deleted) {
      run();
      return;
    }
    Alert.alert(
      `${labels[kind]}を永久に削除しますか？`,
      {
        trip: 'この旅行のカテゴリー・スタンプと、付属するすべての投稿（ゴミ箱内・アップロード中を含む）が永久に削除されます。復元できません。',
        category:
          'このカテゴリーだけに属するスタンプと、付属するすべての投稿（ゴミ箱内・アップロード中を含む）が永久に削除されます。復元できません。別のカテゴリーにも属するスタンプと投稿は残ります。',
        stamp:
          'すべてのカテゴリーからこのスタンプを削除し、付属するすべての投稿（ゴミ箱内・アップロード中を含む）も永久に削除します。復元できません。',
      }[kind],
      [
        { text: 'キャンセル', style: 'cancel' },
        { text: '永久に削除', style: 'destructive', onPress: run },
      ],
    );
  };
  const save = () => {
    if (deleted) {
      void task.run(finishDeletion);
      return;
    }
    if (coverPicking) return;
    void task
      .run(async () => {
        if (savedTarget) {
          await flow.finish({
            target: savedTarget,
            ...(viaCategoryId ? { viaCategoryId } : {}),
          });
          return;
        }
        let target: NotificationTarget;
        if (kind === 'trip') {
          if (newTrip && useTemplate && !templates.ready)
            throw new Error(
              'スタンプ候補の読み込みを待つか、テンプレートを使わずに作成してください。',
            );
          const activities = newTrip
            ? {
                activityPresets: activityPresets.map(validateDomainName),
                customActivities:
                  normalizeLocations(customActivities).map(validateDomainName),
                selectedCategories: useTemplate
                  ? selectedCategories(
                      templates.categories,
                      templates.selection,
                    )
                  : [],
              }
            : {};
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
                ...activities,
                clientRequestId: cover.requestId,
              });
          cover.saved();
          target = { type: 'trip', tripId: trip.id };
        } else if (kind === 'category') {
          const input = { name: values.name, description: values.description };
          const category = id
            ? await actions.updateCategory(userId!, id, input)
            : await actions.createCategory(userId!, {
                ...input,
                tripId: tripId!,
              });
          target = { type: 'category', categoryId: category.id };
        } else {
          if (!categoryIds.length)
            throw new Error('カテゴリーを1つ以上選んでください。');
          const input = {
            name: values.name,
            description: values.description,
            categoryIds,
          };
          const stamp = id
            ? await actions.updateStamp(userId!, id, input)
            : await actions.createStamp(userId!, {
                ...input,
                tripId: tripId!,
              });
          target = { type: 'stamp', stampId: stamp.id };
        }
        // A failed ancestor fetch can be retried without creating the entity twice.
        setSavedTarget(target);
        await flow.finish({
          target,
          ...(viaCategoryId ? { viaCategoryId } : {}),
        });
      })
      .finally(cover.finish);
  };
  return (
    <FormPage
      title={`${labels[kind]}を${id ? '編集' : '作成'}`}
      pending={pending}
      error={task.error}
      onSave={save}
      disabled={
        !deleted &&
        !savedTarget &&
        ((newTrip && useTemplate && !templates.ready) ||
          (kind === 'stamp' &&
            (!categoryIds.length ||
              categories.isPending ||
              !!categories.error)))
      }
      saveLabel={
        deleted
          ? '一覧に戻る'
          : coverPicking
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
        disabled={pending || deleted || !!savedTarget}
        hint="1〜100文字"
        hideLabel={kind === 'trip'}
      />
      {kind === 'stamp' ? (
        <StampCategoriesField
          categories={categories.data ?? []}
          selected={categoryIds}
          onChange={setCategoryIds}
          disabled={
            pending ||
            !!savedTarget ||
            categories.isPending ||
            !!categories.error
          }
          pending={categories.isPending}
          error={categories.error?.message ?? null}
          onRetry={categories.invalidate}
        />
      ) : null}
      {kind === 'trip' ? (
        <>
          <DateField
            value={{ startDate: values.startDate, endDate: values.endDate }}
            onChange={(range) => setValues((v) => ({ ...v, ...range }))}
            disabled={pending || deleted || !!savedTarget}
          />
          <LocationsField
            values={values.locations}
            onChange={(locations) => setValues((v) => ({ ...v, locations }))}
            disabled={pending || deleted || !!savedTarget}
          />
          {newTrip ? (
            <ActivitiesField
              templates={templates}
              selected={activityPresets}
              custom={customActivities}
              disabled={pending || deleted || !!savedTarget}
              onChange={setActivityPresets}
              onCustomChange={setCustomActivities}
            />
          ) : null}
          <CoverField
            uri={cover.uri}
            tripId={id}
            onSelect={cover.select}
            onRemove={cover.remove}
            onPendingChange={setCoverPicking}
            disabled={pending || deleted || !!savedTarget}
          />
          {newTrip ? (
            <TemplateCandidatesField
              templates={templates}
              useTemplate={useTemplate}
              onUseTemplateChange={setUseTemplate}
              disabled={pending || deleted || !!savedTarget}
            />
          ) : null}
        </>
      ) : (
        <TextField
          label="説明（任意）"
          value={values.description}
          onChangeText={(description) =>
            setValues((v) => ({ ...v, description }))
          }
          multiline
          disabled={pending || deleted || !!savedTarget}
          hint="2,000文字以内"
        />
      )}
      {id && !savedTarget ? (
        <Button
          label={deleted ? '一覧に戻る' : `${labels[kind]}を削除`}
          variant="danger"
          onPress={remove}
          disabled={pending}
        />
      ) : null}
    </FormPage>
  );
}
