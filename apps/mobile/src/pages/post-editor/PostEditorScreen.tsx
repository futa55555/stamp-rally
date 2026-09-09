import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { useDetail, useList } from '../../features/app-data/api/queries';
import { useEditor } from '../../features/editor/EditorProvider';
import { useEditorGuard } from '../../features/editor/hooks/useEditorGuard';
import { FormPage } from '../../features/editor/ui/FormPage';
import { usePhotoPicker } from '../../features/photos/hooks/usePhotoPicker';
import {
  MAX_POST_PHOTOS,
  validateMediaSelection,
  type PickedMedia,
} from '../../features/photos/model/inputs';
import { SelectedMediaGrid } from '../../features/photos/ui/SelectedMediaGrid';
import type { Genre, Stamp, Trip } from '../../features/trips/model/types';
import { useUploads } from '../../features/uploads/UploadProvider';
import { UploadList } from '../../features/uploads/UploadList';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { SelectField } from '../../shared/ui/SelectField';

export function PostEditorScreen() {
  const params = useLocalSearchParams<{
    stampId?: string;
    genreId?: string;
    tripId?: string;
    batchId?: string;
    initialTripId?: string;
    initialGenreId?: string;
    initialStampId?: string;
  }>();
  const { userId } = useData();
  const { manager, batches } = useUploads();
  const flow = useEditor();
  const focused = useIsFocused();
  const [destination, setDestination] = useState<{
    tripId?: string;
    genreId?: string;
    stampId?: string;
  }>();
  const initialStamp = useDetail<Stamp>(
    `/stamps/${params.initialStampId}`,
    !destination && !!params.initialStampId && !params.initialGenreId,
  );
  const initialGenreId = params.initialGenreId ?? initialStamp.data?.genreId;
  const initialGenre = useDetail<Genre>(
    `/genres/${initialGenreId}`,
    !destination && !!initialGenreId && !params.initialTripId,
  );
  const { tripId, genreId, stampId } = destination ?? {
    tripId: params.tripId ?? params.initialTripId ?? initialGenre.data?.tripId,
    genreId: params.genreId ?? initialGenreId,
    stampId: params.stampId ?? params.initialStampId,
  };
  const [files, setFiles] = useState<PickedMedia[]>([]);
  const [batchId, setBatchId] = useState(params.batchId);
  const [completedStampId, setCompletedStampId] = useState<string | null>(null);
  const submission = useRef<{
    batchId?: string;
    stampId?: string;
    clientIds?: Set<string>;
    completed?: boolean;
  } | null>(params.batchId ? { batchId: params.batchId } : null);
  const navigationAttempted = useRef(false);
  const task = useTask();
  const pending = task.pending || flow.finishing;
  const locked = pending || !!batchId || !!completedStampId;
  const destinationPending = initialStamp.isPending || initialGenre.isPending;
  const trips = useList<Trip>('/trips', {}, !params.stampId && !params.genreId);
  const genres = useList<Genre>(
    '/genres',
    { tripId },
    !!tripId && !params.stampId,
  );
  const stamps = useList<Stamp>(
    '/stamps',
    { genreId },
    !!genreId && !params.stampId,
  );
  useEditorGuard(files.length > 0, pending);
  useEffect(() => {
    if (!manager) return;
    return manager.subscribeCompletion((batch) => {
      const current = submission.current;
      if (!current || current.completed) return;
      const matches = current.batchId
        ? current.batchId === batch.clientRequestId
        : current.stampId === batch.stampId &&
          current.clientIds?.size === batch.files.length &&
          batch.files.every((file) => current.clientIds!.has(file.clientId));
      if (!matches) return;
      current.completed = true;
      current.clientIds ??= new Set(batch.files.map((file) => file.clientId));
      setBatchId(undefined);
      setCompletedStampId(batch.stampId);
    });
  }, [manager]);
  useEffect(() => {
    // A cancelled or discarded batch has no successful destination to open.
    if (
      batchId &&
      !task.pending &&
      !batches.some((batch) => batch.clientRequestId === batchId)
    ) {
      submission.current = null;
      setBatchId(undefined);
    }
  }, [batchId, batches, task.pending]);
  useEffect(() => {
    if (!completedStampId || pending || !focused || navigationAttempted.current)
      return;
    navigationAttempted.current = true;
    void task.run(() =>
      flow.finish({ target: { type: 'stamp', stampId: completedStampId } }),
    );
  }, [completedStampId, pending, focused, task.run, flow.finish]);
  const picker = usePhotoPicker((picked) => {
    validateMediaSelection(picked);
    setFiles(picked);
  }, MAX_POST_PHOTOS);
  const mediaCount =
    batchId || completedStampId
      ? (batches.find((batch) => batch.clientRequestId === batchId)?.files
          .length ??
        submission.current?.clientIds?.size ??
        0)
      : files.length;
  return (
    <FormPage
      title="写真・動画を追加"
      saveLabel={
        completedStampId
          ? 'スタンプを開く'
          : batchId
            ? 'アップロード中…'
            : 'アップロードを開始'
      }
      pending={pending}
      disabled={
        !completedStampId &&
        (!!batchId || !stampId || !files.length || !manager || picker.pending)
      }
      error={
        task.error ??
        picker.error ??
        (!destination
          ? (initialStamp.error?.message ?? initialGenre.error?.message)
          : null) ??
        trips.error?.message ??
        genres.error?.message ??
        stamps.error?.message ??
        null
      }
      onSave={() => {
        if (completedStampId) {
          void task.run(() =>
            flow.finish({
              target: { type: 'stamp', stampId: completedStampId },
            }),
          );
          return;
        }
        if (!stampId || !manager || !userId || submission.current) return;
        void task.run(async () => {
          // Match selected IDs before add resolves: a restored/idempotent batch
          // can already be READY in its first server response.
          const current = {
            stampId,
            clientIds: new Set(files.map((file) => file.clientId)),
          };
          submission.current = current;
          try {
            const id = await manager.add(stampId, files);
            setFiles([]);
            if (!submission.current?.completed) {
              submission.current = { ...current, batchId: id };
              setBatchId(id);
            }
          } catch (error) {
            submission.current = null;
            throw error;
          }
        });
      }}
    >
      {!params.stampId ? (
        <View>
          {!params.genreId ? (
            <>
              <SelectField
                label="旅行"
                disabled={locked || destinationPending}
                icon="bag-suitcase-outline"
                value={tripId}
                placeholder="旅行を選ぶ"
                options={(trips.data ?? []).map((trip) => ({
                  value: trip.id,
                  label: trip.name,
                }))}
                onChange={(value) => {
                  setDestination({ tripId: value });
                }}
              />
              <SelectField
                label="ジャンル"
                disabled={locked || destinationPending}
                icon="shape-outline"
                value={genreId}
                placeholder="ジャンルを選ぶ"
                options={(genres.data ?? []).map((genre) => ({
                  value: genre.id,
                  label: genre.name,
                }))}
                onChange={(value) => {
                  setDestination({ tripId, genreId: value });
                }}
              />
            </>
          ) : null}
          <SelectField
            label="スタンプ"
            disabled={locked || destinationPending}
            icon="stamper"
            value={stampId}
            placeholder="スタンプを選ぶ"
            options={(stamps.data ?? []).map((stamp) => ({
              value: stamp.id,
              label: stamp.name,
            }))}
            onChange={(value) =>
              setDestination({ tripId, genreId, stampId: value })
            }
          />
        </View>
      ) : null}
      <View className="gap-3">
        <AppText variant="heading">
          写真・動画 {mediaCount} / {MAX_POST_PHOTOS}
        </AppText>
        <AppText tone="textSecondary">
          写真は1枚50 MBまで。動画は5本まで、1本1 GB・5分以内です。
        </AppText>
        {!batchId && !completedStampId ? (
          files.length ? (
            <>
              <SelectedMediaGrid files={files} />
              <Button
                label="選び直す"
                icon="reload"
                variant="secondary"
                disabled={locked || picker.pending}
                onPress={() => {
                  setFiles([]);
                  task.clearError();
                  picker.clearError();
                }}
              />
            </>
          ) : (
            <>
              <Button
                label="ライブラリから選ぶ"
                icon="image-multiple-outline"
                variant="secondary"
                disabled={locked || picker.pending}
                onPress={picker.library}
              />
              <Button
                label="カメラで撮影"
                icon="camera-outline"
                variant="secondary"
                disabled={locked || picker.pending}
                onPress={picker.camera}
              />
            </>
          )
        ) : null}
        {picker.pending ? (
          <AppText tone="textSecondary">原本を準備しています…</AppText>
        ) : null}
        <UploadList stampId={stampId} batchId={batchId} />
      </View>
    </FormPage>
  );
}
