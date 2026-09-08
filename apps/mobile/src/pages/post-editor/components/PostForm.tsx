import { useEffect } from 'react';
import { useData } from '../../../features/app-data/AppDataProvider';
import { useEditor } from '../../../features/editor/EditorProvider';
import { useEditorGuard } from '../../../features/editor/hooks/useEditorGuard';
import type { PostDraft } from '../../../features/editor/model/draft';
import {
  initializePostDraft,
  selectPostScope,
} from '../../../features/editor/model/draft';
import { FormPage } from '../../../features/editor/ui/FormPage';
import { usePhotoPicker } from '../../../features/photos/hooks/usePhotoPicker';
import { MAX_POST_PHOTOS } from '../../../features/photos/model/inputs';
import { PhotoField } from '../../../features/photos/ui/PhotoField';
import { useTask } from '../../../shared/hooks/useTask';
import { AppText } from '../../../shared/ui/AppText';
import { PostDestinationFields } from './PostDestinationFields';

export function PostForm({ initial }: { initial: PostDraft }) {
  const { data, userId, actions } = useData();
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
  return (
    <FormPage
      title="投稿を作成"
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
      <PostDestinationFields
        draft={draft}
        disabled={pending}
        onChange={(field, id) =>
          setDraft((current) => selectPostScope(current ?? initial, field, id))
        }
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
