import {
  validateMediaSelection,
  type PickedMedia,
} from '../photos/model/inputs';
import {
  isTerminal,
  missingPartNumbers,
  type CompletedPart,
  type LocalUpload,
  type PendingBatch,
  type UploadBatch,
  type UploadItem,
} from './model';

type Ports = {
  request<T>(
    method: string,
    url: string,
    data?: unknown,
    signal?: AbortSignal,
  ): Promise<T>;
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  retain(clientId: string, uri: string): Promise<string>;
  remove(uri: string): void;
  transfer(options: {
    uri: string;
    url: string;
    mimeType: string;
    signal: AbortSignal;
    progress: (sent: number) => void;
    start?: number;
    end?: number;
  }): Promise<string | undefined>;
  changed(): void;
  uuid(): string;
};
const retryable = (error: unknown) => {
  if (error && typeof error === 'object') {
    if ('retryable' in error) return error.retryable !== false;
    if ('status' in error && typeof error.status === 'number')
      return error.status >= 500 || [408, 429].includes(error.status);
  }
  return true;
};
export class UploadManager {
  private batches: PendingBatch[] = [];
  private listeners = new Set<() => void>();
  private completionListeners = new Set<(batch: PendingBatch) => void>();
  private controllers = new Map<string, AbortController>();
  private running = false;
  private active = false;
  private stopped = false;
  private ready = false;
  private writes = Promise.resolve();
  constructor(
    readonly userId: string,
    private ports: Ports,
  ) {}
  snapshot = () => this.batches;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  subscribeCompletion = (listener: (batch: PendingBatch) => void) => {
    this.completionListeners.add(listener);
    return () => {
      this.completionListeners.delete(listener);
    };
  };
  private current(batch: PendingBatch) {
    return (
      !this.stopped &&
      batch.userId === this.userId &&
      this.batches.includes(batch)
    );
  }
  private publishBatch(batch: PendingBatch, changed = false) {
    if (!this.current(batch)) return;
    const completed = batch.files.every((file) => isTerminal(file.status));
    if (completed) {
      batch.files.forEach((file) =>
        this.controllers.get(file.clientId)?.abort(),
      );
      this.batches = this.batches.filter((entry) => entry !== batch);
    }
    this.publish();
    if (changed) this.ports.changed();
    if (completed && batch.files.some((file) => file.status === 'READY'))
      this.completionListeners.forEach((listener) => listener(batch));
  }
  private publish(persist = true) {
    this.batches = [...this.batches];
    this.listeners.forEach((listener) => listener());
    if (persist) {
      // Signed URLs and access tokens are deliberately never persisted.
      const value = JSON.stringify(this.batches);
      this.writes = this.writes
        .catch(() => {})
        .then(() => this.ports.write(value));
      void this.writes.catch(() => {});
    }
  }
  private check(batch?: PendingBatch) {
    if (this.stopped) throw new Error('ログインが変更されました。');
    if (batch && !this.current(batch)) throw new Error('送信は終了しました。');
  }
  async load() {
    const raw = await this.ports.read();
    this.check();
    if (raw) {
      const records: PendingBatch[] = JSON.parse(raw);
      if (!Array.isArray(records))
        throw new Error('送信状況を復元できませんでした。');
      this.batches = records.filter((batch) => {
        if (batch.userId !== this.userId) return false;
        if (!batch.files.every((file) => isTerminal(file.status))) return true;
        batch.files.forEach((file) => this.ports.remove(file.uri));
        return false;
      });
    }
    this.ready = true;
    this.clearTransportErrors();
    this.publish(false);
    void this.pump();
  }
  setActive(active: boolean) {
    const wasActive = this.active;
    this.active = active;
    if (!active) this.controllers.forEach((controller) => controller.abort());
    else {
      if (!wasActive) this.clearTransportErrors();
      void this.pump();
    }
  }
  private clearTransportErrors() {
    if (!this.ready) return;
    for (const batch of this.batches) {
      if (batch.retryable) batch.error = undefined;
      for (const file of batch.files)
        if (
          file.status === 'PENDING' &&
          file.retryable &&
          !file.cancelRequested
        )
          file.error = undefined;
    }
    this.publish();
  }
  stop() {
    this.stopped = true;
    this.setActive(false);
  }
  async add(stampId: string, files: PickedMedia[]) {
    if (!this.ready) throw new Error('送信状況を読み込み中です。');
    validateMediaSelection(files);
    const batch: PendingBatch = {
      clientRequestId: this.ports.uuid(),
      userId: this.userId,
      stampId,
      createdAt: Date.now(),
      files: [],
    };
    try {
      for (const file of files) {
        const uri = await this.ports.retain(file.clientId, file.uri);
        batch.files.push({ ...file, uri, status: 'PENDING', progress: 0 });
        this.check();
      }
      this.batches.push(batch);
      this.publish();
      // Persist source files and idempotency key before the server can accept them.
      await this.writes;
      this.check();
    } catch (error) {
      this.batches = this.batches.filter((entry) => entry !== batch);
      batch.files.forEach((file) => this.ports.remove(file.uri));
      this.publish();
      throw error;
    }
    void this.pump();
    return batch.clientRequestId;
  }
  reconcile(batch: PendingBatch, server: UploadBatch, authoritative = false) {
    if (!this.current(batch)) return;
    batch.id = server.id;
    let published = false;
    for (const file of batch.files) {
      const remote = server.uploads.find(
        (item) => item.clientId === file.clientId,
      );
      if (!remote) {
        if (authoritative) {
          this.controllers.get(file.clientId)?.abort();
          file.status = 'CANCELLED';
          file.error = undefined;
          file.progress = 0;
          this.ports.remove(file.uri);
        }
        continue;
      }
      file.id = remote.id;
      // A stale polling response must not undo a terminal state or cancellation.
      if (isTerminal(file.status)) continue;
      if (remote.status === 'PENDING' && file.status === 'PROCESSING') continue;
      published ||= remote.status === 'READY';
      file.status = remote.status;
      if (remote.status === 'FAILED') {
        file.error =
          '変換できませんでした。再試行するか、別のファイルを選んでください。';
        file.retryable = false;
      }
      if (isTerminal(remote.status)) {
        file.error = undefined;
        file.progress = remote.status === 'READY' ? 1 : 0;
        this.ports.remove(file.uri);
      }
    }
    this.publishBatch(batch, published);
  }
  private async initialize(batch: PendingBatch): Promise<UploadBatch> {
    this.check(batch);
    const server = batch.id
      ? await this.ports.request<UploadBatch>(
          'GET',
          `/uploads/batches/${batch.id}`,
        )
      : await this.ports.request<UploadBatch>('POST', '/uploads/batches', {
          clientRequestId: batch.clientRequestId,
          stampId: batch.stampId,
          files: batch.files.map(
            ({
              clientId,
              fileName,
              mimeType,
              byteSize,
              mediaType,
              durationMs,
            }) => ({
              clientId,
              fileName,
              mimeType,
              byteSize,
              mediaType,
              durationMs,
            }),
          ),
        });
    this.check(batch);
    batch.unavailable = false;
    batch.error = undefined;
    this.reconcile(batch, server, true);
    await this.writes;
    return server;
  }
  private async send(
    batch: PendingBatch,
    file: LocalUpload,
    remote: UploadItem,
  ) {
    // Earlier files can take hours. Obtain a fresh single-upload signature at
    // the point of use, and explicitly renew expired PENDING sessions.
    if (
      !remote.upload ||
      (remote.upload.kind === 'single' &&
        Date.parse(remote.upload.expiresAt) <= Date.now() + 60_000)
    ) {
      remote = await this.ports.request<UploadItem>(
        'POST',
        `/uploads/${remote.id}/retry`,
      );
      this.check(batch);
      this.reconcile(batch, { id: batch.id!, uploads: [remote] });
      if (remote.status !== 'PENDING') return;
    }
    if (file.status !== 'PENDING' || file.cancelRequested) return;
    if (!remote.upload)
      throw new Error('送信先を取得できませんでした。再試行してください。');
    const controller = new AbortController();
    this.controllers.set(file.clientId, controller);
    const signal = controller.signal;
    const check = () => {
      this.check(batch);
      if (signal.aborted || file.cancelRequested)
        throw new Error('送信を中断しました。');
    };
    try {
      let parts: CompletedPart[] | undefined;
      if (remote.upload.kind === 'single') {
        await this.ports.transfer({
          uri: file.uri,
          url: remote.upload.url,
          mimeType: file.mimeType,
          signal,
          progress: (sent) => {
            if (!this.current(batch) || signal.aborted) return;
            file.progress = Math.min(1, sent / file.byteSize);
            this.publish(false);
          },
        });
      } else {
        const partSize = remote.upload.partSize;
        const existing = await this.ports.request<{
          parts: CompletedPart[];
          completed?: boolean;
        }>('GET', `/uploads/${remote.id}/parts`, undefined, signal);
        check();
        if (existing.completed) {
          const result = await this.ports.request<UploadItem>(
            'POST',
            `/uploads/${remote.id}/complete`,
            {},
            signal,
          );
          check();
          this.reconcile(batch, { id: batch.id!, uploads: [result] });
          return;
        }
        const missing = missingPartNumbers(
          file.byteSize,
          partSize,
          existing.parts,
        );
        parts = existing.parts.filter(
          (part) => !missing.includes(part.partNumber),
        );
        let sent = parts.reduce((sum, part) => sum + part.byteSize, 0);
        file.progress = sent / file.byteSize;
        for (const partNumber of missing) {
          check();
          const signed = await this.ports.request<{
            parts: { partNumber: number; url: string }[];
          }>(
            'POST',
            `/uploads/${remote.id}/parts`,
            { partNumbers: [partNumber] },
            signal,
          );
          check();
          const url = signed.parts.find(
            (part) => part.partNumber === partNumber,
          )?.url;
          if (!url) throw new Error('分割送信先を取得できませんでした。');
          const start = (partNumber - 1) * partSize;
          const end = Math.min(start + partSize, file.byteSize);
          const etag = await this.ports.transfer({
            uri: file.uri,
            url,
            mimeType: file.mimeType,
            start,
            end,
            signal,
            progress: (bytes) => {
              if (!this.current(batch) || signal.aborted) return;
              file.progress = Math.min(1, (sent + bytes) / file.byteSize);
              this.publish(false);
            },
          });
          check();
          if (!etag)
            throw new Error(
              '送信結果を確認できませんでした。再試行してください。',
            );
          parts.push({ partNumber, etag, byteSize: end - start });
          sent += end - start;
        }
      }
      check();
      const result = await this.ports.request<UploadItem>(
        'POST',
        `/uploads/${remote.id}/complete`,
        parts
          ? {
              parts: parts
                .sort((a, b) => a.partNumber - b.partNumber)
                .map(({ partNumber, etag }) => ({ partNumber, etag })),
            }
          : {},
        signal,
      );
      check();
      this.reconcile(batch, { id: batch.id!, uploads: [result] });
    } finally {
      if (this.controllers.get(file.clientId) === controller)
        this.controllers.delete(file.clientId);
    }
  }
  private async pump() {
    if (this.running || !this.active || !this.ready || this.stopped) return;
    this.running = true;
    try {
      for (const batch of this.batches) {
        if (!this.active || this.stopped) break;
        if (
          !this.current(batch) ||
          batch.unavailable ||
          batch.error ||
          batch.files.every(
            (file) =>
              isTerminal(file.status) ||
              file.status === 'PROCESSING' ||
              !!file.error,
          )
        )
          continue;
        let server: UploadBatch;
        try {
          server = await this.initialize(batch);
        } catch (error) {
          if (this.current(batch)) {
            batch.error =
              error instanceof Error
                ? error.message
                : '送信先を取得できませんでした。';
            batch.retryable = retryable(error);
            this.markUnavailable(batch, error);
            this.publish();
          }
          continue;
        }
        for (const file of batch.files) {
          if (!this.active || !this.current(batch)) break;
          if (file.cancelRequested && !isTerminal(file.status) && !file.error) {
            await this.cancel(batch.clientRequestId, file.clientId).catch(
              (error: unknown) => {
                if (!this.current(batch)) return;
                file.error =
                  error instanceof Error
                    ? error.message
                    : 'キャンセルできませんでした。';
                this.publish();
              },
            );
            continue;
          }
          if (file.status !== 'PENDING' || file.error) continue;
          try {
            const remote = server.uploads.find(
              (item) => item.clientId === file.clientId,
            );
            if (!remote) throw new Error('送信先が見つかりません。');
            await this.send(batch, file, remote);
          } catch (error) {
            if (!this.current(batch)) continue;
            if (this.active && !this.stopped && !file.cancelRequested) {
              file.error =
                error instanceof Error
                  ? error.message
                  : '送信できませんでした。';
              file.retryable = retryable(error);
            }
            this.publish();
          }
        }
      }
    } finally {
      this.running = false;
      // A batch may have been added, or the app foregrounded, while a previous
      // request was unwinding. Do not leave that work waiting for another event.
      if (
        this.active &&
        !this.stopped &&
        this.batches.some(
          (batch) =>
            !batch.unavailable &&
            !batch.error &&
            batch.files.some(
              (file) => file.status === 'PENDING' && !file.error,
            ),
        )
      )
        void this.pump();
    }
  }
  async retry(batchKey: string, clientId?: string) {
    const batch = this.batches.find(
      (entry) => entry.clientRequestId === batchKey,
    );
    if (!batch) return;
    batch.error = undefined;
    batch.unavailable = false;
    const file = batch.files.find((entry) => entry.clientId === clientId);
    if (file) {
      file.error = undefined;
      if (file.id && (file.status === 'FAILED' || file.status === 'PENDING')) {
        try {
          const remote = await this.ports.request<UploadItem>(
            'POST',
            `/uploads/${file.id}/retry`,
          );
          this.check(batch);
          this.reconcile(batch, { id: batch.id!, uploads: [remote] });
        } catch (error) {
          if (!this.current(batch)) return;
          file.error =
            error instanceof Error ? error.message : '再試行できませんでした。';
          file.retryable = retryable(error);
          this.publish();
          throw error;
        }
      }
    }
    this.publish();
    await this.writes;
    void this.pump();
  }
  async dismiss(batchKey: string) {
    const batch = this.batches.find(
      (entry) => entry.clientRequestId === batchKey,
    );
    if (!batch?.unavailable) return;
    batch.files.forEach((file) => this.controllers.get(file.clientId)?.abort());
    batch.files.forEach((file) => this.ports.remove(file.uri));
    this.batches = this.batches.filter((entry) => entry !== batch);
    this.publish();
    await this.writes;
  }
  markUnavailable(batch: PendingBatch, error: unknown) {
    if (
      !this.current(batch) ||
      !error ||
      typeof error !== 'object' ||
      !('status' in error) ||
      ![403, 404].includes(Number(error.status))
    )
      return;
    batch.unavailable = true;
    batch.retryable = false;
    batch.error =
      '投稿先が削除されたか、アクセスできなくなりました。この端末の送信記録を消せます。';
    batch.files.forEach((file) => this.controllers.get(file.clientId)?.abort());
    this.publish();
  }
  async cancel(batchKey: string, clientId: string) {
    const batch = this.batches.find(
      (entry) => entry.clientRequestId === batchKey,
    );
    const file = batch?.files.find((entry) => entry.clientId === clientId);
    if (!batch || !file || isTerminal(file.status)) return;
    file.cancelRequested = true;
    this.controllers.get(file.clientId)?.abort();
    this.publish();
    await this.writes;
    if (!this.current(batch) || isTerminal(file.status)) return;
    try {
      if (!file.id) await this.initialize(batch);
      if (!this.current(batch) || isTerminal(file.status)) return;
      await this.ports.request('DELETE', `/uploads/${file.id}`);
    } catch (error) {
      if (!this.current(batch)) return;
      throw error;
    }
    this.check();
    if (!this.current(batch) || isTerminal(file.status)) return;
    file.status = 'CANCELLED';
    file.error = undefined;
    this.ports.remove(file.uri);
    this.publishBatch(batch);
    await this.writes;
  }
}
