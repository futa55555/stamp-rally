import { ActivityIndicator, View } from 'react-native';
import { SelectedMediaGrid } from '../photos/ui/SelectedMediaGrid';
import { useTask } from '../../shared/hooks/useTask';
import { useAppTheme } from '../../shared/theme/ThemeProvider';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { useUploads } from './UploadProvider';
import { isTerminal, type LocalUpload } from './model';

const hasFailed = (file: LocalUpload) =>
  !isTerminal(file.status) &&
  !file.cancelRequested &&
  (file.status === 'FAILED' || !!file.error);

export function UploadList({
  stampId,
  batchId,
}: {
  stampId?: string;
  batchId?: string;
}) {
  const { manager, batches, error } = useUploads();
  const task = useTask();
  const theme = useAppTheme();
  const selected = batches.filter(
    (batch) =>
      (!stampId || batch.stampId === stampId) &&
      (!batchId || batch.clientRequestId === batchId),
  );
  if (!selected.length && !error) return null;
  const files = selected
    .flatMap((batch) => batch.files)
    .filter((file) => file.status !== 'CANCELLED');
  const completed = files.filter((file) => file.status === 'READY').length;
  const failed = files.filter(hasFailed);
  const working =
    task.pending ||
    (!error &&
      selected.some(
        (batch) =>
          !batch.error &&
          !batch.unavailable &&
          batch.files.some(
            (file) =>
              (file.status === 'PENDING' || file.status === 'PROCESSING') &&
              !file.error &&
              !file.cancelRequested,
          ),
      ));
  const retryTargets = selected.flatMap<{ batchId: string; clientId?: string }>(
    (batch) => {
      if (batch.unavailable) return [];
      const failures = batch.files.filter(hasFailed);
      if (failures.length)
        return failures.map((file) => ({
          batchId: batch.clientRequestId,
          clientId: file.clientId,
        }));
      return batch.error ? [{ batchId: batch.clientRequestId }] : [];
    },
  );
  const unavailable = selected.filter((batch) => batch.unavailable);
  return (
    <View className="gap-4 rounded-2xl bg-surfaceSubtle p-4">
      <View className="flex-row items-center gap-3">
        {working ? (
          <ActivityIndicator
            size="small"
            color={theme.colors.primary}
            accessibilityLabel="アップロード処理中"
          />
        ) : null}
        <View className="flex-1 gap-1">
          <AppText variant="label">アップロード</AppText>
          {files.length ? (
            <AppText tone="textSecondary" accessibilityLiveRegion="polite">
              投稿完了 {completed} / {files.length}
            </AppText>
          ) : null}
        </View>
      </View>
      {working ? (
        <AppText tone="textSecondary">
          このページを離れても、投稿は続きます。
        </AppText>
      ) : null}
      <ErrorMessage
        message={
          error ??
          task.error ??
          selected.find((batch) => batch.error)?.error ??
          null
        }
      />
      {failed.length ? (
        <View className="gap-3">
          <AppText variant="label" tone="error">
            投稿に失敗した写真・動画
          </AppText>
          <SelectedMediaGrid files={failed} />
        </View>
      ) : null}
      {retryTargets.length ? (
        <Button
          label="再試行"
          variant="secondary"
          disabled={!manager || task.pending}
          onPress={() => {
            void task.run(async () => {
              const results = await Promise.allSettled(
                retryTargets.map(({ batchId, clientId }) =>
                  manager?.retry(batchId, clientId),
                ),
              );
              const failure = results.find(
                (result) => result.status === 'rejected',
              );
              if (failure) throw failure.reason;
            });
          }}
        />
      ) : null}
      {unavailable.length ? (
        <Button
          label="この端末の送信記録を消す"
          variant="secondary"
          disabled={!manager || task.pending}
          onPress={() => {
            void task.run(async () => {
              for (const batch of unavailable)
                await manager?.dismiss(batch.clientRequestId);
            });
          }}
        />
      ) : null}
    </View>
  );
}
