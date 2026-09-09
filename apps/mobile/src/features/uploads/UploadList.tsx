import { View } from 'react-native';
import { useTask } from '../../shared/hooks/useTask';
import { AppText } from '../../shared/ui/AppText';
import { Button } from '../../shared/ui/Button';
import { ErrorMessage } from '../../shared/ui/ErrorMessage';
import { useUploads } from './UploadProvider';
import { isTerminal } from './model';

export function UploadList({
  stampId,
  batchId,
}: {
  stampId?: string;
  batchId?: string;
}) {
  const { manager, batches, error } = useUploads();
  const task = useTask();
  const selected = batches.filter(
    (batch) =>
      (!stampId || batch.stampId === stampId) &&
      (!batchId || batch.clientRequestId === batchId),
  );
  if (!selected.length && !error) return null;
  return (
    <View className="gap-4 p-4">
      <AppText variant="heading">アップロード</AppText>
      <ErrorMessage message={error ?? task.error} />
      {selected.map((batch) => (
        <View key={batch.clientRequestId} className="gap-3">
          {batch.error ? (
            <>
              <ErrorMessage message={batch.error} />
              <Button
                label="接続を再試行"
                variant="secondary"
                onPress={() => {
                  void task.run(async () =>
                    manager?.retry(batch.clientRequestId),
                  );
                }}
              />
            </>
          ) : null}
          {batch.unavailable ? (
            <Button
              label="この端末の送信記録を消す"
              variant="secondary"
              onPress={() => {
                void task.run(async () =>
                  manager?.dismiss(batch.clientRequestId),
                );
              }}
            />
          ) : null}
          {batch.files.map((file) => (
            <View
              key={file.clientId}
              className="gap-1 rounded-lg bg-surfaceSubtle p-3"
            >
              <AppText numberOfLines={1}>{file.fileName}</AppText>
              <AppText variant="caption" tone="textSecondary">
                {file.status === 'READY'
                  ? '公開しました'
                  : file.status === 'CANCELLED'
                    ? 'キャンセルしました'
                    : file.status === 'PROCESSING'
                      ? '表示用データを準備しています…'
                      : file.cancelRequested
                        ? 'キャンセルを待っています'
                        : file.error
                          ? '送信・変換を停止しています'
                          : `送信中 ${Math.round(file.progress * 100)}%`}
              </AppText>
              <ErrorMessage message={file.error ?? null} />
              {!batch.unavailable && !isTerminal(file.status) ? (
                <View className="flex-row gap-2">
                  {file.error && !file.cancelRequested ? (
                    <Button
                      label="再試行"
                      variant="secondary"
                      disabled={task.pending}
                      onPress={() => {
                        void task.run(async () =>
                          manager?.retry(batch.clientRequestId, file.clientId),
                        );
                      }}
                    />
                  ) : null}
                  <Button
                    label="キャンセル"
                    variant="secondary"
                    disabled={task.pending}
                    onPress={() => {
                      void task.run(async () =>
                        manager?.cancel(batch.clientRequestId, file.clientId),
                      );
                    }}
                  />
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ))}
      <AppText variant="caption" tone="textSecondary">
        送信が中断した場合は、アプリを開くと再開します。送信済みの変換はアプリを閉じても続きます。
      </AppText>
    </View>
  );
}
