import { useRouter } from 'expo-router';
import { StateView } from '../../shared/ui/StateView';

export function PostEditorScreen() {
  const router = useRouter();
  return (
    <StateView
      title="写真投稿は準備中です"
      description="写真の追加は、今後のアップデートで利用できるようになります。"
      icon="camera-outline"
      action={{ label: '戻る', onPress: () => router.back() }}
    />
  );
}
