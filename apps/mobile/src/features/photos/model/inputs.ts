export const MAX_POST_PHOTOS = 30;
export const MAX_POST_VIDEOS = 5;
export const MAX_IMAGE_BYTES = 50_000_000;
export const MAX_VIDEO_BYTES = 1_000_000_000;
export const MAX_VIDEO_DURATION_MS = 300_000;

export type PickedMedia = {
  clientId: string;
  uri: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  mediaType: 'IMAGE' | 'VIDEO';
  durationMs?: number;
};

export function validateMediaSelection(files: PickedMedia[]): void {
  if (!files.length || files.length > MAX_POST_PHOTOS)
    throw new Error('一度に追加できる写真・動画は1〜30件です。');
  if (
    files.filter((file) => file.mediaType === 'VIDEO').length > MAX_POST_VIDEOS
  )
    throw new Error('一度に追加できる動画は5本までです。');
  for (const file of files) {
    const video = file.mediaType === 'VIDEO';
    if (!Number.isSafeInteger(file.byteSize) || file.byteSize <= 0)
      throw new Error(
        `${file.fileName}のサイズを確認できません。選び直してください。`,
      );
    if (file.byteSize > (video ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES))
      throw new Error(
        `${file.fileName}は${video ? '1 GB' : '50 MB'}を超えています。`,
      );
    if (
      video &&
      file.durationMs !== undefined &&
      (!Number.isFinite(file.durationMs) ||
        file.durationMs < 0 ||
        file.durationMs > MAX_VIDEO_DURATION_MS)
    )
      throw new Error('動画は5分以内にしてください。');
    if (
      !(
        video
          ? ['video/mp4', 'video/quicktime']
          : [
              'image/jpeg',
              'image/png',
              'image/webp',
              'image/heic',
              'image/heif',
              'image/avif',
            ]
      ).includes(file.mimeType)
    )
      throw new Error(`${file.fileName}の形式には対応していません。`);
  }
}

export type CreatePostsInput = { stampId: string; mediaUrls: string[] };
