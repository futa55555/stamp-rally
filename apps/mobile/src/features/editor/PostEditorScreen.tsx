import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppText, ListRow, StateView } from '../../components/ui';
import { useData } from '../../data/AppDataProvider';
import { MAX_POST_PHOTOS } from '../../data/mutations';
import { useTask } from '../hooks';
import { useEditor } from './EditorProvider';
import { initializePostDraft, type PostDraft, type PostScope } from './draft';
import { FormPage, useEditorGuard } from './form';
import { PhotoField, usePhotoPicker } from './photos';

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

function PostForm({ initial }: { initial: PostDraft }) {
  const { data, userId, actions } = useData();
  const router = useRouter();
  const flow = useEditor();
  const { setDraft } = flow;
  useEffect(() => {
    setDraft((current) => current ?? initial);
  }, [initial, setDraft]);
  const draft = flow.draft ?? initial;
  const task = useTask();
  const picker = usePhotoPicker(
    (uris) =>
      setDraft((current) => {
        const previous = current ?? initial;
        return { ...previous, mediaUrls: [...previous.mediaUrls, ...uris] };
      }),
    MAX_POST_PHOTOS - draft.mediaUrls.length,
  );
  const pending = task.pending || picker.pending || flow.finishing;
  useEditorGuard(JSON.stringify(draft) !== JSON.stringify(initial), pending);
  const trip = data.trips.find((t) => t.id === draft.tripId);
  const genre = data.genres.find((g) => g.id === draft.genreId);
  const stamp = data.stamps.find((s) => s.id === draft.stampId);
  const choose = (field: keyof PostScope) =>
    router.push({ pathname: '/editor/select', params: { field } });
  return (
    <FormPage
      title="写真を投稿"
      pending={pending}
      error={task.error ?? picker.error}
      saveLabel={
        draft.mediaUrls.length
          ? `${draft.mediaUrls.length}枚を投稿する`
          : '写真を投稿する'
      }
      disabled={!draft.stampId || !draft.mediaUrls.length}
      onSave={() => {
        void task.run(async () => {
          initializePostDraft(data, userId!, draft);
          await actions.createPosts(userId!, {
            stampId: draft.stampId!,
            mediaUrls: draft.mediaUrls,
          });
          flow.finish({ target: { type: 'stamp', stampId: draft.stampId! } });
        });
      }}
    >
      <AppText variant="heading">投稿先</AppText>
      <ListRow
        title="旅行"
        subtitle={trip?.name ?? '旅行を選択'}
        icon="bag-suitcase-outline"
        onPress={pending ? undefined : () => choose('tripId')}
      />
      <ListRow
        title="ジャンル"
        subtitle={
          genre?.name ??
          (trip ? 'ジャンルを選択・作成' : '先に旅行を選択してください')
        }
        icon="compass-outline"
        onPress={!pending && trip ? () => choose('genreId') : undefined}
      />
      <ListRow
        title="スタンプ"
        subtitle={
          stamp?.name ??
          (genre ? 'スタンプを選択・作成' : '先にジャンルを選択してください')
        }
        icon="postage-stamp"
        onPress={!pending && genre ? () => choose('stampId') : undefined}
      />
      <PhotoField
        uris={draft.mediaUrls}
        max={MAX_POST_PHOTOS}
        picker={picker}
        disabled={pending}
        onRemove={(index) =>
          setDraft((current) =>
            current
              ? {
                  ...current,
                  mediaUrls: current.mediaUrls.filter((_, i) => i !== index),
                }
              : current,
          )
        }
      />
      <AppText variant="caption" tone="textMuted">
        写真は同じスタンプに投稿されます。最大{MAX_POST_PHOTOS}枚まで選べます。
      </AppText>
    </FormPage>
  );
}
