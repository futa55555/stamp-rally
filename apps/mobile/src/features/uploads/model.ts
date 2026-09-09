import type { PickedMedia } from '../photos/model/inputs';

export type UploadStatus =
  'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'CANCELLED';
export type UploadItem = {
  id: string;
  clientId: string;
  status: UploadStatus;
  errorCode?: string | null;
  upload?:
    | { kind: 'single'; url: string; expiresAt: string }
    | { kind: 'multipart'; partSize: number }
    | null;
};
export type UploadBatch = { id: string; uploads: UploadItem[] };
export type CompletedPart = {
  partNumber: number;
  etag: string;
  byteSize: number;
};
export type LocalUpload = PickedMedia & {
  id?: string;
  status: UploadStatus;
  progress: number;
  error?: string;
  retryable?: boolean;
  cancelRequested?: boolean;
};
export type PendingBatch = {
  clientRequestId: string;
  id?: string;
  userId: string;
  stampId: string;
  createdAt: number;
  files: LocalUpload[];
  error?: string;
  retryable?: boolean;
  unavailable?: boolean;
};
export const isTerminal = (status: UploadStatus) =>
  status === 'READY' || status === 'CANCELLED';

export function missingPartNumbers(
  byteSize: number,
  partSize: number,
  completed: CompletedPart[],
) {
  if (!Number.isSafeInteger(partSize) || partSize < 5 * 1024 * 1024)
    throw new Error('アップロード設定が不正です。');
  const present = new Set(
    completed
      .filter(
        (part) =>
          part.byteSize ===
          Math.min(partSize, byteSize - (part.partNumber - 1) * partSize),
      )
      .map((part) => part.partNumber),
  );
  return Array.from(
    { length: Math.ceil(byteSize / partSize) },
    (_, i) => i + 1,
  ).filter((n) => !present.has(n));
}
