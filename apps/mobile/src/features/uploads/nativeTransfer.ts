import { Directory, File, FileMode, Paths } from 'expo-file-system';

const root = (userId: string) =>
  new Directory(Paths.document, 'pending-uploads', encodeURIComponent(userId));
export async function retainOriginal(
  userId: string,
  clientId: string,
  uri: string,
) {
  const directory = root(userId);
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, clientId);
  if (!file.exists) {
    try {
      await new File(uri).copy(file);
    } catch (error) {
      if (file.exists) file.delete();
      throw error;
    }
  }
  return file.uri;
}
export function removeOriginal(userId: string, uri: string) {
  if (!uri.startsWith(`${root(userId).uri.replace(/\/$/, '')}/`)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* retry cleanup on next reconciliation */
  }
}

export async function transferFile({
  uri,
  url,
  mimeType,
  signal,
  progress,
  start,
  end,
}: {
  uri: string;
  url: string;
  mimeType: string;
  signal: AbortSignal;
  progress: (sent: number) => void;
  start?: number;
  end?: number;
}) {
  let source = new File(uri);
  if (!source.exists)
    throw Object.assign(
      new Error(
        '送信する原本が見つかりません。キャンセルして選び直してください。',
      ),
      { retryable: false },
    );
  let temporary: File | undefined;
  try {
    if (start !== undefined && end !== undefined) {
      // File.slice() in Expo 57 reads the entire file. Keep memory bounded by
      // copying one multipart part to disk in 256 KiB chunks instead.
      temporary = new File(Paths.cache, `upload-part-${source.name}-${start}`);
      temporary.create({ overwrite: true });
      const read = source.open(FileMode.ReadOnly);
      const write = temporary.open(FileMode.ReadWrite);
      try {
        read.offset = start;
        let remaining = end - start;
        while (remaining > 0) {
          if (signal.aborted) throw new Error('送信を中断しました。');
          const bytes = read.readBytes(Math.min(256 * 1024, remaining));
          if (!bytes.length)
            throw new Error('原本の読み込みが途中で終了しました。');
          write.writeBytes(bytes);
          remaining -= bytes.length;
          // Yield to cancellation and UI updates without accumulating buffers.
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
        }
      } finally {
        read.close();
        write.close();
      }
      source = temporary;
    }
    const response = await source
      .createUploadTask(url, {
        httpMethod: 'PUT',
        headers: { 'Content-Type': mimeType },
        sessionType: 'foreground',
        signal,
        onProgress: ({ bytesSent }) => progress(bytesSent),
      })
      .uploadAsync();
    if (response.status < 200 || response.status >= 300)
      throw new Error(
        response.status === 403
          ? '送信URLの期限が切れました。再試行してください。'
          : '送信できませんでした。再試行してください。',
      );
    return Object.entries(response.headers).find(
      ([name]) => name.toLowerCase() === 'etag',
    )?.[1];
  } finally {
    if (temporary?.exists) temporary.delete();
  }
}
