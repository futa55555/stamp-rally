import { describe, expect, it, vi } from 'vitest';
import { UploadManager } from './UploadManager';
import { type PendingBatch, type UploadBatch, type UploadItem } from './model';
import {
  validateMediaSelection,
  type PickedMedia,
} from '../photos/model/inputs';
import { displayUrl } from '../photos/model/display';
import type { Post } from '../photos/model/types';

const image: PickedMedia = {
  clientId: 'image-1',
  uri: 'file:///picker/image',
  fileName: 'IMG.HEIC',
  mimeType: 'image/heic',
  byteSize: 50_000_000,
  mediaType: 'IMAGE',
};
const video: PickedMedia = {
  clientId: 'video-1',
  uri: 'file:///picker/video',
  fileName: 'IMG.MOV',
  mimeType: 'video/quicktime',
  byteSize: 1_000_000_000,
  durationMs: 300_000,
  mediaType: 'VIDEO',
};
function harness() {
  let storage: string | null = null;
  const item: UploadItem = {
    id: 'post-1',
    clientId: image.clientId,
    status: 'PENDING',
    upload: {
      kind: 'single',
      url: 'https://r2.example/signed?secret=upload',
      expiresAt: '2099',
    },
  };
  const batch: UploadBatch = { id: 'batch-1', uploads: [item] };
  const ports = {
    request: vi.fn(async (method: string, url: string) => {
      if (url.endsWith('/retry')) return { ...item };
      if (url.endsWith('/complete')) {
        item.status = 'PROCESSING';
        return { ...item, upload: null };
      }
      if (method === 'DELETE') {
        item.status = 'CANCELLED';
        return undefined;
      }
      return structuredClone(batch);
    }) as unknown as ConstructorParameters<typeof UploadManager>[1]['request'] &
      ReturnType<typeof vi.fn>,
    read: vi.fn(async () => storage),
    write: vi.fn(async (value: string) => {
      storage = value;
    }),
    retain: vi.fn(async (id: string) => `file:///private/user/${id}`),
    remove: vi.fn(),
    transfer: vi.fn(async () => 'etag'),
    changed: vi.fn(),
    uuid: () => 'request-1',
  };
  return {
    ports,
    item,
    batch,
    storage: () => storage,
    manager: new UploadManager('user-1', ports),
  };
}

describe('media boundaries and derivative isolation', () => {
  it('accepts exact inclusive limits and rejects one above each boundary', () => {
    expect(() =>
      validateMediaSelection([
        ...Array.from({ length: 25 }, () => image),
        ...Array.from({ length: 5 }, () => video),
      ]),
    ).not.toThrow();
    for (const selection of [
      Array.from({ length: 31 }, () => image),
      Array.from({ length: 6 }, () => video),
      [{ ...image, byteSize: 50_000_001 }],
      [{ ...video, byteSize: 1_000_000_001 }],
      [{ ...video, durationMs: 300_001 }],
      [{ ...image, byteSize: 0 }],
      [{ ...image, mimeType: 'image/gif' }],
    ])
      expect(() => validateMediaSelection(selection)).toThrow();
  });
  it('never returns a legacy original or playback URL for image display, including incomplete rows', () => {
    const post = {
      mediaUrl: 'https://original',
      playbackUrl: 'https://playback',
    } as Post;
    expect(displayUrl(post, 'small')).toBeNull();
    expect(displayUrl(post, 'large')).toBeNull();
    expect(
      displayUrl(
        {
          ...post,
          smallUrl: 'https://small',
          largeUrl: 'https://large',
          status: 'READY',
        },
        'large',
      ),
    ).toBe('https://large');
    expect(
      displayUrl(
        { ...post, smallUrl: 'https://small', status: 'PROCESSING' },
        'small',
      ),
    ).toBeNull();
  });
});

describe('durable upload orchestration', () => {
  it('persists private originals and the idempotency key before creating posts and never stores signed URLs', async () => {
    const { manager, ports, storage } = harness();
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp-1', [image]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(ports.write.mock.invocationCallOrder[0]).toBeLessThan(
      ports.request.mock.invocationCallOrder[0],
    );
    expect(storage()).toContain('file:///private/user/image-1');
    expect(storage()).not.toContain('secret=upload');
    expect(ports.request).toHaveBeenCalledWith(
      'POST',
      '/uploads/batches',
      expect.objectContaining({ clientRequestId: 'request-1' }),
    );
    manager.stop();
  });
  it('reuses the same batch key after a lost server response and app restart', async () => {
    const { manager, ports } = harness();
    ports.request.mockRejectedValueOnce(
      new Error('Connection lost after server accepted the batch'),
    );
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp-1', [image]);
    await vi.waitFor(() => expect(manager.snapshot()[0].error).toBeTruthy());
    manager.stop();
    const restored = new UploadManager('user-1', ports);
    await restored.load();
    restored.setActive(true);
    await restored.retry('request-1');
    await vi.waitFor(() =>
      expect(restored.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    const creates = ports.request.mock.calls.filter(
      ([method, url]) => method === 'POST' && url === '/uploads/batches',
    );
    expect(creates).toHaveLength(2);
    expect(creates[0][2]).toEqual(creates[1][2]);
    restored.stop();
  });
  it('discovers accepted multipart parts on R2 and sends only the missing byte ranges', async () => {
    const { manager, ports, item, batch } = harness();
    item.clientId = video.clientId;
    const partSize = 16 * 1024 * 1024;
    item.upload = { kind: 'multipart', partSize };
    const bytes = 2 * partSize + 100;
    ports.request.mockImplementation(
      async (method: string, url: string, data: unknown) => {
        if (url.endsWith('/parts') && method === 'GET')
          return {
            parts: [{ partNumber: 1, etag: 'first', byteSize: partSize }],
          };
        if (url.endsWith('/parts'))
          return {
            parts: [
              {
                partNumber: (data as { partNumbers: number[] }).partNumbers[0],
                url: 'https://r2/part',
              },
            ],
          };
        if (url.endsWith('/complete'))
          return { ...item, status: 'PROCESSING', upload: null };
        return batch;
      },
    );
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [{ ...video, byteSize: bytes }]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(ports.transfer).toHaveBeenCalledTimes(2);
    expect(ports.transfer).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ start: partSize, end: partSize * 2 }),
    );
    expect(ports.transfer).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ start: partSize * 2, end: bytes }),
    );
    expect(ports.request).toHaveBeenCalledWith(
      'POST',
      '/uploads/post-1/complete',
      {
        parts: [
          { partNumber: 1, etag: 'first' },
          { partNumber: 2, etag: 'etag' },
          { partNumber: 3, etag: 'etag' },
        ],
      },
      expect.any(AbortSignal),
    );
    manager.stop();
  });
  it('automatically removes completed batches, emits completion once, and ignores stale polls', async () => {
    const { manager, ports, item, batch, storage } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [image]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    const pending = manager.snapshot()[0];
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'PENDING' }],
    });
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    expect(manager.snapshot()).toEqual([]);
    expect(pending.files[0].status).toBe('READY');
    expect(completed).toHaveBeenCalledExactlyOnceWith(pending);
    expect(ports.changed).toHaveBeenCalledOnce();
    expect(ports.remove).toHaveBeenCalledWith('file:///private/user/image-1');
    expect(
      ports.request.mock.calls.some(([method]) => method === 'DELETE'),
    ).toBe(false);
    await vi.waitFor(() => expect(storage()).toBe('[]'));
    manager.stop();
  });
  it('fences a late native transfer after sign-out, and never restores another user’s pending media', async () => {
    const { manager, ports } = harness();
    let finish!: () => void;
    ports.transfer.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve('etag');
        }),
    );
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [image]);
    await vi.waitFor(() => expect(ports.transfer).toHaveBeenCalledOnce());
    manager.stop();
    finish();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(
      ports.request.mock.calls.some(([, url]) =>
        String(url).endsWith('/complete'),
      ),
    ).toBe(false);
    const otherUser = new UploadManager('user-2', ports);
    await otherUser.load();
    otherUser.setActive(true);
    expect(otherUser.snapshot()).toEqual([]);
    otherUser.stop();
  });
  it('does not create server records when durable storage fails', async () => {
    const { manager, ports } = harness();
    await manager.load();
    manager.setActive(true);
    ports.write.mockRejectedValue(new Error('Disk full'));
    await expect(manager.add('stamp', [image])).rejects.toThrow('Disk full');
    expect(ports.request).not.toHaveBeenCalled();
    expect(ports.remove).toHaveBeenCalledOnce();
    manager.stop();
  });
  it('restores an already completed multipart object without resending its bytes', async () => {
    const { manager, ports, item, batch } = harness();
    item.clientId = video.clientId;
    item.upload = { kind: 'multipart', partSize: 16 * 1024 * 1024 };
    ports.request.mockImplementation(async (_method: string, url: string) => {
      if (url.endsWith('/parts')) return { completed: true, parts: [] };
      if (url.endsWith('/complete'))
        return { ...item, status: 'PROCESSING', upload: null };
      return batch;
    });
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [video]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(ports.transfer).not.toHaveBeenCalled();
    expect(ports.request).toHaveBeenCalledWith(
      'POST',
      '/uploads/post-1/complete',
      {},
      expect.any(AbortSignal),
    );
    manager.stop();
  });
  it('renews an expired pending session before sending and automatically clears completed records durably', async () => {
    const { manager, ports, item, batch, storage } = harness();
    item.upload = null;
    const original = ports.request.getMockImplementation() as (
      method: string,
      url: string,
      ...args: unknown[]
    ) => Promise<unknown>;
    ports.request.mockImplementation(
      async (method: string, url: string, ...args: unknown[]) => {
        if (url.endsWith('/retry'))
          return {
            ...item,
            upload: {
              kind: 'single',
              url: 'https://r2/fresh',
              expiresAt: '2099-01-01',
            },
          };
        return original(method, url, ...args);
      },
    );
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [image]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(ports.request).toHaveBeenCalledWith('POST', '/uploads/post-1/retry');
    expect(ports.transfer).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://r2/fresh' }),
    );
    await manager.dismiss('request-1');
    expect(manager.snapshot()).toHaveLength(1);
    manager.reconcile(manager.snapshot()[0], {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    expect(manager.snapshot()).toEqual([]);
    await vi.waitFor(() => expect(storage()).toBe('[]'));
    manager.stop();
  });
  it('does not overwrite storage while an initial restore is still pending', async () => {
    const { manager, ports } = harness();
    let restore!: (value: string | null) => void;
    ports.read.mockImplementation(
      () =>
        new Promise((resolve) => {
          restore = resolve;
        }),
    );
    const loading = manager.load();
    manager.setActive(true);
    expect(ports.write).not.toHaveBeenCalled();
    restore(null);
    await loading;
    manager.stop();
  });
  it('resumes a transient send failure on foreground and preserves conversion failures for explicit retry', async () => {
    const { manager, ports } = harness();
    ports.transfer.mockRejectedValueOnce(new Error('Network disconnected'));
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [image]);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].error).toBe('Network disconnected'),
    );
    manager.setActive(false);
    manager.setActive(true);
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(ports.transfer).toHaveBeenCalledTimes(2);
    manager.stop();
  });
  it('treats missing rows as deleted only in full batch snapshots and cleans up retained originals', async () => {
    const { manager, ports, batch } = harness();
    await manager.load();
    await manager.add('stamp', [image]);
    manager.reconcile(manager.snapshot()[0], { ...batch, uploads: [] });
    expect(manager.snapshot()[0].files[0].status).toBe('PENDING');
    manager.reconcile(manager.snapshot()[0], { ...batch, uploads: [] }, true);
    expect(manager.snapshot()).toEqual([]);
    expect(ports.remove).toHaveBeenCalledWith('file:///private/user/image-1');
    manager.stop();
  });
  it('lets the owner discard local records after losing access to their upload destination', async () => {
    const { manager, ports } = harness();
    await manager.load();
    await manager.add('stamp', [image]);
    manager.markUnavailable(manager.snapshot()[0], { status: 403 });
    manager.setActive(true);
    expect(ports.request).not.toHaveBeenCalled();
    await manager.dismiss('request-1');
    expect(manager.snapshot()).toEqual([]);
    expect(ports.remove).toHaveBeenCalledWith('file:///private/user/image-1');
    manager.stop();
  });
  it('keeps unfinished and failed files available until every file in the batch finishes', async () => {
    const { manager, ports, item, batch } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    await manager.add('stamp', [image, { ...image, clientId: 'image-2' }]);
    const pending = manager.snapshot()[0];
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    expect(manager.snapshot()).toEqual([pending]);
    expect(completed).not.toHaveBeenCalled();
    const second: UploadItem = {
      ...item,
      id: 'post-2',
      clientId: 'image-2',
      status: 'PROCESSING',
    };
    manager.reconcile(pending, { ...batch, uploads: [second] });
    expect(manager.snapshot()).toEqual([pending]);
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...second, status: 'FAILED' }],
    });
    expect(manager.snapshot()[0].files[1].status).toBe('FAILED');
    expect(manager.snapshot()[0].files[1].error).toBeTruthy();
    expect(completed).not.toHaveBeenCalled();
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...second, status: 'READY' }],
    });
    expect(manager.snapshot()).toEqual([]);
    expect(completed).toHaveBeenCalledExactlyOnceWith(pending);
    expect(ports.changed).toHaveBeenCalledTimes(2);
    manager.stop();
  });
  it('clears cancelled batches without announcing a successful upload', async () => {
    const { manager, storage } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    await manager.add('stamp', [image]);
    await manager.cancel('request-1', image.clientId);
    expect(manager.snapshot()).toEqual([]);
    expect(storage()).toBe('[]');
    expect(completed).not.toHaveBeenCalled();
    manager.stop();
  });
  it('finishes a batch with successful and cancelled files and supports unsubscribing', async () => {
    const { manager, item, batch } = harness();
    const completed = vi.fn();
    const unsubscribed = vi.fn();
    manager.subscribeCompletion(completed);
    manager.subscribeCompletion(unsubscribed)();
    await manager.load();
    await manager.add('stamp', [image, { ...image, clientId: 'image-2' }]);
    const pending = manager.snapshot()[0];
    manager.reconcile(pending, {
      ...batch,
      uploads: [
        { ...item, status: 'READY' },
        { ...item, id: 'post-2', clientId: 'image-2', status: 'PENDING' },
      ],
    });
    await manager.cancel('request-1', 'image-2');
    expect(manager.snapshot()).toEqual([]);
    expect(completed).toHaveBeenCalledExactlyOnceWith(pending);
    expect(unsubscribed).not.toHaveBeenCalled();
    manager.stop();
  });
  it('prunes old completed records on restore without navigating or deleting published posts', async () => {
    const { manager, ports, storage } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    const record = (
      key: string,
      status: PendingBatch['files'][number]['status'],
    ): PendingBatch => ({
      clientRequestId: key,
      stampId: 'stamp',
      userId: 'user-1',
      createdAt: 1,
      files: [{ ...image, status, progress: 0 }],
    });
    const unfinished = [
      record('pending', 'PENDING'),
      record('processing', 'PROCESSING'),
      record('failed', 'FAILED'),
    ];
    ports.read.mockResolvedValue(
      JSON.stringify([
        record('ready', 'READY'),
        record('cancelled', 'CANCELLED'),
        ...unfinished,
      ]),
    );
    await manager.load();
    expect(manager.snapshot()).toEqual(unfinished);
    await vi.waitFor(() => expect(JSON.parse(storage()!)).toEqual(unfinished));
    expect(completed).not.toHaveBeenCalled();
    expect(ports.request).not.toHaveBeenCalled();
    expect(ports.remove).toHaveBeenCalledTimes(2);
    manager.stop();
  });
  it('does not cancel a published post when an in-flight initialization discovers completion', async () => {
    const { manager, ports, item } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    await manager.add('stamp', [image]);
    item.status = 'READY';
    await manager.cancel('request-1', image.clientId);
    expect(manager.snapshot()).toEqual([]);
    expect(completed).toHaveBeenCalledOnce();
    expect(
      ports.request.mock.calls.some(([method]) => method === 'DELETE'),
    ).toBe(false);
    manager.stop();
  });
  it('ignores a late cancellation initialization after polling already completed the batch', async () => {
    const { manager, ports, item, batch } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    await manager.add('stamp', [image]);
    const pending = manager.snapshot()[0];
    let finish!: (result: UploadBatch) => void;
    ports.request.mockImplementationOnce(
      () =>
        new Promise<UploadBatch>((resolve) => {
          finish = resolve;
        }),
    );
    const cancelling = manager.cancel('request-1', image.clientId);
    await vi.waitFor(() => expect(ports.request).toHaveBeenCalledOnce());
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    finish(batch);
    await expect(cancelling).resolves.toBeUndefined();
    expect(manager.snapshot()).toEqual([]);
    expect(completed).toHaveBeenCalledOnce();
    expect(
      ports.request.mock.calls.some(([method]) => method === 'DELETE'),
    ).toBe(false);
    manager.stop();
  });
  it('fences a late native transfer after completion and continues a later submission', async () => {
    const { manager, ports, item, batch } = harness();
    let finish!: () => void;
    ports.transfer.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          finish = () => resolve('etag');
        }),
    );
    await manager.load();
    manager.setActive(true);
    await manager.add('stamp', [image]);
    await vi.waitFor(() => expect(ports.transfer).toHaveBeenCalledOnce());
    const pending = manager.snapshot()[0];
    manager.reconcile(pending, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    item.clientId = 'image-2';
    item.id = 'post-2';
    await manager.add('stamp-2', [{ ...image, clientId: item.clientId }]);
    finish();
    await vi.waitFor(() =>
      expect(manager.snapshot()[0].files[0].status).toBe('PROCESSING'),
    );
    expect(manager.snapshot()).toHaveLength(1);
    expect(manager.snapshot()[0].stampId).toBe('stamp-2');
    expect(
      ports.request.mock.calls.some(
        ([, url]) => url === '/uploads/post-1/complete',
      ),
    ).toBe(false);
    expect(ports.transfer).toHaveBeenCalledTimes(2);
    manager.stop();
  });
  it('ignores detached batch responses without changing a later submission', async () => {
    const { manager, ports, item, batch } = harness();
    const completed = vi.fn();
    manager.subscribeCompletion(completed);
    await manager.load();
    await manager.add('stamp', [image]);
    const previous = manager.snapshot()[0];
    manager.reconcile(previous, {
      ...batch,
      uploads: [{ ...item, status: 'READY' }],
    });
    await manager.add('stamp-2', [image]);
    const current = manager.snapshot()[0];
    manager.reconcile(previous, { id: 'stale-batch', uploads: [] }, true);
    manager.markUnavailable(previous, { status: 403 });
    expect(manager.snapshot()).toEqual([current]);
    expect(current.files[0].status).toBe('PENDING');
    expect(current.unavailable).toBeUndefined();
    expect(previous.files[0].status).toBe('READY');
    expect(previous.id).toBe('batch-1');
    expect(previous.unavailable).toBeUndefined();
    expect(completed).toHaveBeenCalledOnce();
    expect(ports.remove).toHaveBeenCalledOnce();
    manager.stop();
  });
});
