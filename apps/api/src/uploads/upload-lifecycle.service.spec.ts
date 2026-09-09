import type { PrismaService } from '../database/prisma.service.js';
import type { ObjectStorageService } from '../storage/object-storage.service.js';
import {
  InvalidMediaError,
  type MediaProcessor,
} from '../media-processing/media-processor.service.js';
import type { MediaQueue } from '../media-processing/media-queue.service.js';
import { UploadLifecycleService } from './upload-lifecycle.service.js';

const result = {
  originalKey: 'media/id/1/original',
  largeKey: 'media/id/1/large',
  smallKey: 'media/id/1/small',
  playbackKey: null,
  blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  width: 2000,
  height: 1000,
  byteSize: 1234,
  mimeType: 'image/jpeg',
  duration: null,
};

/** Stateful DB double enforces the claim/publish predicates used to avoid duplicate work. */
function setup() {
  let row: Record<string, any> | null = {
    id: 'post',
    status: 'PROCESSING',
    processingVersion: 1,
    processingAttempts: 0,
    processingStartedAt: null,
    authorId: 'author',
    mediaType: 'IMAGE',
    stagingKey: 'staging/source',
    isLegacy: false,
  };
  const cleanup: Array<Record<string, unknown>> = [];
  const post = {
    updateMany: vi.fn(
      async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: Record<string, any>;
      }) => {
        if (
          !row ||
          row.id !== where.id ||
          row.status !== where.status ||
          row.processingVersion !== where.processingVersion
        )
          return { count: 0 };
        if (
          where.processingAttempts?.lt &&
          row.processingAttempts >= where.processingAttempts.lt
        )
          return { count: 0 };
        if (
          where.processingAttempts?.gte &&
          row.processingAttempts < where.processingAttempts.gte
        )
          return { count: 0 };
        if (
          where.OR &&
          row.processingStartedAt &&
          row.processingStartedAt.getTime() >= Date.now() - 2 * 60 * 60_000
        )
          return { count: 0 };
        row.updatedAt = data.updatedAt ?? new Date();
        for (const [key, value] of Object.entries(data))
          row[key] =
            value && typeof value === 'object' && 'increment' in value
              ? row[key] + value.increment
              : value;
        return { count: 1 };
      },
    ),
    findUnique: vi.fn(async () => (row ? { ...row } : null)),
    findUniqueOrThrow: vi.fn(async () => ({
      author: { name: 'Owner' },
      stamp: { genre: { tripId: 'trip' } },
    })),
  };
  const notification = { createMany: vi.fn(async () => ({ count: 1 })) };
  const prisma: Record<string, any> = {
    post,
    mediaCleanup: {
      create: vi.fn(async ({ data }) => {
        cleanup.push(data);
        return data;
      }),
    },
    tripMember: { findMany: vi.fn(async () => [{ userId: 'member' }]) },
    notification,
  };
  prisma.$transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(prisma),
  );
  const processor = {
    process: vi.fn(async () => ({ ...result })),
    processLegacy: vi.fn(async () => ({ ...result })),
  };
  const service = new UploadLifecycleService(
    prisma as PrismaService,
    {} as ObjectStorageService,
    processor as unknown as MediaProcessor,
    {} as MediaQueue,
  );
  return {
    service,
    processor,
    post,
    notification,
    cleanup,
    get row() {
      return row;
    },
    remove() {
      row = null;
    },
  };
}

describe('Upload lifecycle publication', () => {
  it('publishes only once, signs no original display URLs, and notifies once', async () => {
    const context = setup();
    await context.service.process('post', 1);
    await context.service.process('post', 1);
    expect(context.row).toMatchObject({
      status: 'READY',
      originalKey: result.originalKey,
      processingAttempts: 1,
      stagingKey: null,
    });
    expect(context.processor.process).toHaveBeenCalledTimes(1);
    expect(context.notification.createMany).toHaveBeenCalledTimes(1);
    expect(context.cleanup).toEqual([
      expect.objectContaining({ keys: ['staging/source'] }),
    ]);
  });

  it('retries transient failures durably and publishes on the third attempt', async () => {
    const context = setup();
    context.processor.process
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockRejectedValueOnce(new Error('network unavailable'));
    await expect(context.service.process('post', 1)).rejects.toThrow(
      'network unavailable',
    );
    expect(context.row).toMatchObject({
      status: 'PROCESSING',
      processingAttempts: 1,
      processingStartedAt: null,
    });
    await expect(context.service.process('post', 1)).rejects.toThrow(
      'network unavailable',
    );
    await context.service.process('post', 1);
    expect(context.row).toMatchObject({
      status: 'READY',
      processingAttempts: 3,
    });
    expect(context.notification.createMany).toHaveBeenCalledTimes(1);
  });

  it('fails permanent validation immediately and exhausts transient failures after three attempts', async () => {
    const invalid = setup();
    invalid.processor.process.mockRejectedValue(
      new InvalidMediaError('INVALID_IMAGE'),
    );
    await invalid.service.process('post', 1);
    expect(invalid.row).toMatchObject({
      status: 'FAILED',
      processingAttempts: 1,
      errorCode: 'INVALID_IMAGE',
    });
    expect(invalid.notification.createMany).not.toHaveBeenCalled();
    const transient = setup();
    transient.processor.process.mockRejectedValue(new Error('network'));
    await expect(transient.service.process('post', 1)).rejects.toThrow(
      'network',
    );
    await expect(transient.service.process('post', 1)).rejects.toThrow(
      'network',
    );
    await transient.service.process('post', 1);
    await transient.service.process('post', 1);
    expect(transient.row).toMatchObject({
      status: 'FAILED',
      processingAttempts: 3,
    });
    expect(transient.processor.process).toHaveBeenCalledTimes(3);
  });

  it('does not publish if deleted while processing and durably queues generated objects for removal', async () => {
    const context = setup();
    context.processor.process.mockImplementationOnce(async () => {
      context.remove();
      return { ...result };
    });
    await context.service.process('post', 1);
    expect(context.row).toBeNull();
    expect(context.notification.createMany).not.toHaveBeenCalled();
    expect(context.cleanup).toEqual([
      { keys: [result.originalKey, result.largeKey, result.smallKey] },
    ]);
  });

  it('does not claim another version or duplicate an active lease', async () => {
    const context = setup();
    await context.service.process('post', 0);
    expect(context.processor.process).not.toHaveBeenCalled();
    context.row!.processingStartedAt = new Date();
    await context.service.process('post', 1);
    expect(context.processor.process).not.toHaveBeenCalled();
  });

  it('ends a third attempt killed beyond its lease without processing a fourth time', async () => {
    const context = setup();
    context.row!.processingAttempts = 3;
    context.row!.processingStartedAt = new Date(Date.now() - 3 * 60 * 60_000);
    await context.service.process('post', 1);
    expect(context.row).toMatchObject({
      status: 'FAILED',
      processingAttempts: 3,
    });
    expect(context.processor.process).not.toHaveBeenCalled();
  });

  it('migrates an original without changing legacy timestamps or generating notifications', async () => {
    const context = setup();
    const updatedAt = new Date('2026-09-01T00:00:00Z');
    Object.assign(context.row!, {
      isLegacy: true,
      mediaUrl: 'https://legacy.test/image.jpg',
      updatedAt,
    });
    await context.service.process('post', 1);
    expect(context.row).toMatchObject({
      status: 'READY',
      updatedAt,
      mediaUrl: null,
    });
    expect(context.processor.processLegacy).toHaveBeenCalledWith({
      postId: 'post',
      version: 1,
      mediaType: 'IMAGE',
      url: 'https://legacy.test/image.jpg',
    });
    expect(context.notification.createMany).not.toHaveBeenCalled();
  });
  it('preserves legacy timestamps even when processing fails before publication', async () => {
    const context = setup();
    const updatedAt = new Date('2026-08-15T00:00:00Z');
    Object.assign(context.row!, {
      isLegacy: true,
      mediaUrl: 'https://legacy.test/image.jpg',
      updatedAt,
    });
    context.processor.processLegacy.mockRejectedValue(
      new InvalidMediaError('INVALID_IMAGE'),
    );
    await context.service.process('post', 1);
    expect(context.row).toMatchObject({
      status: 'FAILED',
      updatedAt,
      errorCode: 'INVALID_IMAGE',
    });
  });
});
