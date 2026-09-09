import type { QueryClient } from '@tanstack/react-query';
import type { SessionClient } from '../app-data/api/SessionClient';
import { resourceKey } from '../app-data/api/queries';

export interface CoverDraft {
  uri: string;
  byteSize: number;
  clientRequestId: string;
  assetId?: string;
}
export interface CoverUploadStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  expiresAt: string;
  errorCode: string | null;
  upload: { url: string; expiresAt: string } | null;
}

export function abortableDelay(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new Error('画像の保存を中断しました。もう一度保存してください。'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export async function uploadCover({
  draft,
  client,
  cache,
  userId,
  signal,
  transfer,
  progress,
  newRequestId,
  delay = abortableDelay,
}: {
  draft: CoverDraft;
  client: Pick<SessionClient, 'request' | 'sessionGuard'>;
  cache: QueryClient;
  userId: string;
  signal: AbortSignal;
  transfer: (input: {
    uri: string;
    url: string;
    mimeType: string;
    signal: AbortSignal;
    progress: (sent: number) => void;
  }) => Promise<unknown>;
  progress: (message: string) => void;
  newRequestId: () => string;
  delay?: typeof abortableDelay;
}) {
  const guard = client.sessionGuard();
  const check = () => {
    guard();
    if (signal.aborted)
      throw new Error('画像の保存を中断しました。もう一度保存してください。');
  };
  const get = async () => {
    const queryKey = resourceKey(userId, `/uploads/covers/${draft.assetId}`);
    await cache.invalidateQueries(
      { queryKey, exact: true },
      { cancelRefetch: false },
    );
    check();
    return cache.fetchQuery({
      queryKey,
      queryFn: () =>
        client.request<CoverUploadStatus>({
          url: `/uploads/covers/${draft.assetId}`,
          signal,
        }),
      retry: false,
    });
  };
  progress('画像を準備中…');
  check();
  let state: CoverUploadStatus;
  if (draft.assetId) {
    try {
      state = await get();
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'status' in error &&
        error.status === 404
      ) {
        draft.assetId = undefined;
        draft.clientRequestId = newRequestId();
      }
      throw error;
    }
  } else {
    state = await client.request<CoverUploadStatus>({
      method: 'POST',
      url: '/uploads/covers',
      data: {
        clientRequestId: draft.clientRequestId,
        byteSize: draft.byteSize,
        mimeType: 'image/png',
      },
      signal,
    });
    draft.assetId = state.id;
  }
  check();
  if (state.status === 'FAILED' || Date.parse(state.expiresAt) <= Date.now()) {
    void client
      .request({ method: 'DELETE', url: `/uploads/covers/${state.id}` })
      .catch(() => {});
    draft.assetId = undefined;
    draft.clientRequestId = newRequestId();
    throw new Error(
      '画像を準備できませんでした。もう一度保存するか、写真を選び直してください。',
    );
  }
  if (state.status === 'PENDING') {
    if (!state.upload)
      throw new Error(
        'アップロードの有効期限が切れました。もう一度保存してください。',
      );
    progress('画像をアップロード中… 0%');
    await transfer({
      uri: draft.uri,
      url: state.upload.url,
      mimeType: 'image/png',
      signal,
      progress: (sent) =>
        progress(
          `画像をアップロード中… ${Math.min(100, Math.round((sent / draft.byteSize) * 100))}%`,
        ),
    });
    check();
    state = await client.request<CoverUploadStatus>({
      method: 'POST',
      url: `/uploads/covers/${state.id}/complete`,
      signal,
    });
  }
  const started = Date.now();
  while (state.status === 'PROCESSING') {
    progress('画像を処理中…');
    if (Date.now() - started > 120_000)
      throw new Error(
        '画像の処理に時間がかかっています。少し待ってからもう一度保存してください。',
      );
    await delay(4000, signal);
    check();
    state = await get();
  }
  check();
  if (state.status !== 'READY') {
    void client
      .request({ method: 'DELETE', url: `/uploads/covers/${state.id}` })
      .catch(() => {});
    draft.assetId = undefined;
    draft.clientRequestId = newRequestId();
    throw new Error(
      '画像を処理できませんでした。写真を選び直すか、もう一度保存してください。',
    );
  }
  progress('旅行を保存中…');
  return state.id;
}
