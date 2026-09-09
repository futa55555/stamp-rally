import type { PrismaService } from '../database/prisma.service.js';
import type { TripAccessService } from '../trips/trip-access.service.js';
import type { ObjectStorageService } from '../storage/object-storage.service.js';
import type { MediaQueue } from '../media-processing/media-queue.service.js';
import { UploadsService } from './uploads.service.js';

function setup() {
  const row = {
    id: 'post',
    authorId: 'author',
    stampId: 'stamp',
    uploadBatchId: 'batch',
    mediaType: 'VIDEO',
    status: 'PENDING',
    stagingKey: 'staging/video',
    multipartUploadId: 'multipart',
    byteSize: 1234,
    mimeType: 'video/mp4',
    fileName: 'clip.mp4',
    processingVersion: 0,
    errorCode: null,
    uploadExpiresAt: new Date(Date.now() + 60_000),
  };
  const prisma = {
    post: {
      findFirst: vi.fn(async () => ({ ...row })),
      updateMany: vi.fn(async ({ data }) => {
        Object.assign(row, data, {
          processingVersion: row.processingVersion + 1,
        });
        return { count: 1 };
      }),
    },
  };
  const storage = {
    head: vi.fn(async () => ({ byteSize: 1234 })),
    listParts: vi.fn(async () => [
      { partNumber: 1, etag: 'etag', byteSize: 1234 },
    ]),
    completeMultipart: vi.fn(),
    createMultipart: vi.fn(),
  };
  const queue = { enqueueProcess: vi.fn(async () => undefined) };
  const access = { requireStamp: vi.fn(async () => undefined) };
  const service = new UploadsService(
    prisma as unknown as PrismaService,
    access as unknown as TripAccessService,
    storage as unknown as ObjectStorageService,
    queue as unknown as MediaQueue,
  );
  return { service, storage, queue, access, row };
}

describe('Multipart upload recovery', () => {
  it('reports an already completed R2 object and lets the client complete without parts', async () => {
    const context = setup();
    await expect(context.service.listParts('author', 'post')).resolves.toEqual({
      parts: [],
      completed: true,
    });
    expect(context.storage.listParts).not.toHaveBeenCalled();
    await expect(
      context.service.complete('author', 'post', {}),
    ).resolves.toMatchObject({ status: 'PROCESSING', upload: null });
    expect(context.storage.completeMultipart).not.toHaveBeenCalled();
    expect(context.queue.enqueueProcess).toHaveBeenCalledWith('post', 1);
  });

  it('lists unfinished parts only when the final object does not exist', async () => {
    const context = setup();
    context.storage.head.mockRejectedValue(
      Object.assign(new Error('not found'), { name: 'NotFound' }),
    );
    await expect(context.service.listParts('author', 'post')).resolves.toEqual({
      parts: [{ partNumber: 1, etag: 'etag', byteSize: 1234 }],
      completed: false,
    });
    expect(context.storage.listParts).toHaveBeenCalledWith(
      'staging/video',
      'multipart',
    );
  });

  it('does not confuse storage outages or differently sized objects with completed uploads', async () => {
    const context = setup();
    context.storage.head.mockRejectedValueOnce(new Error('R2 unavailable'));
    await expect(context.service.listParts('author', 'post')).rejects.toThrow(
      'R2 unavailable',
    );
    expect(context.storage.listParts).not.toHaveBeenCalled();
    context.storage.head.mockResolvedValueOnce({ byteSize: 1 });
    await expect(
      context.service.listParts('author', 'post'),
    ).resolves.toMatchObject({ completed: false });
  });

  it('retains PROCESSING as a durable recovery record when the queue is unavailable', async () => {
    const context = setup();
    context.queue.enqueueProcess.mockRejectedValue(
      new Error('queue unavailable'),
    );
    await expect(
      context.service.complete('author', 'post', {}),
    ).resolves.toMatchObject({ status: 'PROCESSING' });
    expect(context.row.status).toBe('PROCESSING');
  });
});
