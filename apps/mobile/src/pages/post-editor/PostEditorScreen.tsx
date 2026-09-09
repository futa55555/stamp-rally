import { useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useData } from '../../features/app-data/AppDataProvider';
import { useList } from '../../features/app-data/api/queries';
import { useEditor } from '../../features/editor/EditorProvider';
import { useEditorGuard } from '../../features/editor/hooks/useEditorGuard';
import { FormPage } from '../../features/editor/ui/FormPage';
import { usePhotoPicker } from '../../features/photos/hooks/usePhotoPicker';
import {
  MAX_POST_PHOTOS,
  validateMediaSelection,
  type PickedMedia,
} from '../../features/photos/model/inputs';
import type { Genre, Stamp, Trip } from '../../features/trips/model/types';
import { useUploads } from '../../features/uploads/UploadProvider';
import { UploadList } from '../../features/uploads/UploadList';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { IconButton } from '../../shared/ui/IconButton';
import { SelectField } from '../../shared/ui/SelectField';

export function PostEditorScreen() {
  const params = useLocalSearchParams<{
    stampId?: string;
    genreId?: string;
    tripId?: string;
    batchId?: string;
  }>();
  const { userId } = useData();
  const { manager, batches } = useUploads();
  const flow = useEditor();
  const focused = useIsFocused();
  const [tripId, setTripId] = useState(params.tripId);
  const [genreId, setGenreId] = useState(params.genreId);
  const [stampId, setStampId] = useState(params.stampId);
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
    const selected = [...files, ...picked];
    validateMediaSelection(selected);
    setFiles(selected);
  }, MAX_POST_PHOTOS - files.length);
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
                disabled={locked}
                icon="bag-suitcase-outline"
                value={tripId}
                placeholder="旅行を選ぶ"
                options={(trips.data ?? []).map((trip) => ({
                  value: trip.id,
                  label: trip.name,
                }))}
                onChange={(value) => {
                  setTripId(value);
                  setGenreId(undefined);
                  setStampId(undefined);
                }}
              />
              <SelectField
                label="ジャンル"
                disabled={locked}
                icon="shape-outline"
                value={genreId}
                placeholder="ジャンルを選ぶ"
                options={(genres.data ?? []).map((genre) => ({
                  value: genre.id,
                  label: genre.name,
                }))}
                onChange={(value) => {
                  setGenreId(value);
                  setStampId(undefined);
                }}
              />
            </>
          ) : null}
          <SelectField
            label="スタンプ"
            disabled={locked}
            icon="stamper"
            value={stampId}
            placeholder="スタンプを選ぶ"
            options={(stamps.data ?? []).map((stamp) => ({
              value: stamp.id,
              label: stamp.name,
            }))}
            onChange={setStampId}
          />
        </View>
      ) : null}
      <AppText variant="heading">写真・動画 {files.length} / 30</AppText>
      <AppText tone="textSecondary">
        写真は1枚50 MBまで。動画は5本まで、1本1 GB・5分以内です。
      </AppText>
      {files.map((file, index) => (
        <View
          key={file.clientId}
          className="flex-row items-center gap-2 rounded-lg bg-surfaceSubtle p-3"
        >
          <View className="flex-1 gap-1">
            <AppText numberOfLines={1}>{file.fileName}</AppText>
            <AppText variant="caption" tone="textSecondary">
              {file.mediaType === 'VIDEO' ? '動画' : '写真'} ·{' '}
              {(file.byteSize / 1_000_000).toFixed(1)} MB
            </AppText>
          </View>
          <IconButton
            icon="close-circle-outline"
            label={`${index + 1}件目の選択を解除`}
            disabled={locked}
            onPress={() =>
              setFiles((current) =>
                current.filter((entry) => entry.clientId !== file.clientId),
              )
            }
          />
        </View>
      ))}
      <Button
        label="ライブラリから選ぶ"
        icon="image-multiple-outline"
        variant="secondary"
        disabled={locked || picker.pending || files.length >= 30}
        onPress={picker.library}
      />
      <Button
        label="カメラで撮影"
        icon="camera-outline"
        variant="secondary"
        disabled={locked || picker.pending || files.length >= 30}
        onPress={picker.camera}
      />
      {picker.pending ? (
        <AppText tone="textSecondary">原本を準備しています…</AppText>
      ) : null}
      <UploadList stampId={stampId} batchId={batchId} />
    </FormPage>
  );
}
