import { useRouter } from 'expo-router';
import { Button } from '../../shared/ui/Button';
import { useUploads } from './UploadProvider';

export function UploadSummary() {
  const router = useRouter();
  const { batches, error } = useUploads();
  if (!batches.length && !error) return null;
  return (
    <Button
      label="写真・動画の送信状況を確認"
      icon="cloud-upload-outline"
      variant="secondary"
      onPress={() => {
        const batch = batches.length === 1 ? batches[0] : null;
        router.push({
          pathname: '/editor/post',
          params: batch
            ? { stampId: batch.stampId, batchId: batch.clientRequestId }
            : {},
        });
      }}
    />
  );
}
