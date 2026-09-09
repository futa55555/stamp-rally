import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { onlineManager, useQueryClient } from '@tanstack/react-query';
import { File } from 'expo-file-system';
import { randomUUID } from 'expo-crypto';
import { useData } from '../app-data/AppDataProvider';
import { transferFile } from '../uploads/nativeTransfer';
import { retainCoverDraft, removeCoverDraft } from './draftFile';
import { uploadCover, type CoverDraft } from './CoverUpload';

export function useCoverUpload(initialUri: string | null) {
  const { client, userId } = useData();
  const cache = useQueryClient();
  const [requestId] = useState(randomUUID);
  const [uri, setUri] = useState(initialUri);
  const [changed, setChanged] = useState(false);
  const [message, setMessage] = useState('');
  const draft = useRef<CoverDraft | null>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const dispose = (value: CoverDraft | null) => {
    if (!value || !userId) return;
    removeCoverDraft(userId, value.uri);
    if (value.assetId)
      void client
        .request({ method: 'DELETE', url: `/uploads/covers/${value.assetId}` })
        .catch(() => {});
  };
  useEffect(() => {
    alive.current = true;
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') controller.current?.abort();
    });
    const unsubscribe = onlineManager.subscribe((online) => {
      if (!online) controller.current?.abort();
    });
    return () => {
      alive.current = false;
      controller.current?.abort();
      app.remove();
      unsubscribe();
      dispose(draft.current);
    };
  }, [userId]);
  return {
    uri,
    changed,
    message,
    requestId,
    select: async (selected: string) => {
      if (!userId) throw new Error('ログインし直してください。');
      const guard = client.sessionGuard();
      const clientRequestId = randomUUID();
      const retained = await retainCoverDraft(
        userId,
        clientRequestId,
        selected,
      );
      const value = {
        uri: retained,
        clientRequestId,
        byteSize: new File(retained).size,
      };
      try {
        guard();
        if (!alive.current) throw new Error('画面を閉じました。');
      } catch (error) {
        removeCoverDraft(userId, retained);
        throw error;
      }
      dispose(draft.current);
      draft.current = value;
      setUri(retained);
      setChanged(true);
    },
    remove: () => {
      dispose(draft.current);
      draft.current = null;
      setUri(null);
      setChanged(true);
    },
    prepare: async (): Promise<{ coverAssetId?: string | null }> => {
      if (!changed) return {};
      if (!draft.current) return { coverAssetId: null };
      if (!userId) throw new Error('ログインし直してください。');
      if (!onlineManager.isOnline())
        throw new Error(
          '通信できません。接続を確認してもう一度保存してください。',
        );
      const abort = new AbortController();
      controller.current = abort;
      try {
        return {
          coverAssetId: await uploadCover({
            draft: draft.current,
            client,
            cache,
            userId,
            signal: abort.signal,
            transfer: transferFile,
            progress: (value) => {
              if (alive.current) setMessage(value);
            },
            newRequestId: randomUUID,
          }),
        };
      } finally {
        controller.current = null;
      }
    },
    finish: () => {
      if (alive.current) setMessage('');
    },
    saved: () => {
      if (draft.current) draft.current.assetId = undefined;
    },
  };
}
