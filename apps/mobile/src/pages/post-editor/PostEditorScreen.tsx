import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { useData } from '../../features/app-data/AppDataProvider';
import type { PostScope } from '../../features/editor/model/draft';
import { initializePostDraft } from '../../features/editor/model/draft';
import { StateView } from '../../shared/ui/StateView';
import { PostForm } from './components/PostForm';

export function PostEditorScreen() {
  const params = useLocalSearchParams<PostScope>();
  const { data, userId } = useData();
  const router = useRouter();
  const [initial] = useState(() => {
    try {
      return { draft: initializePostDraft(data, userId!, params), error: null };
    } catch (error) {
      return {
        draft: null,
        error:
          error instanceof Error ? error.message : '投稿先を確認してください。',
      };
    }
  });
  if (!initial.draft)
    return (
      <StateView
        title="投稿先を開けません"
        description={initial.error ?? undefined}
        action={{ label: '戻る', onPress: () => router.back() }}
      />
    );
  return <PostForm initial={initial.draft} />;
}
