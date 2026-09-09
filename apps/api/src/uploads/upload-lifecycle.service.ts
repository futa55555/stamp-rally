import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { serializable } from '../database/transaction.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import {
  MediaProcessor,
  type ProcessedMedia,
} from '../media-processing/media-processor.service.js';
import { MediaQueue } from '../media-processing/media-queue.service.js';
import { notifyMembers } from '../notifications/notify.js';

// Longer than the processor's bounded decode/transcode time. A killed worker is recovered.
const PROCESSING_LEASE_MS = 2 * 60 * 60_000;
const SIGNED_UPLOAD_GRACE_MS = 20 * 60_000;

@Injectable()
export class UploadLifecycleService {
  private readonly logger = new Logger(UploadLifecycleService.name);
  private orphanCursor: string | undefined;
  private stagingCursor: string | undefined;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly processor: MediaProcessor,
    private readonly queue: MediaQueue,
  ) {}

  async process(postId: string, version: number): Promise<void> {
    // Prisma's @updatedAt applies to claims/failures too, so take the legacy
    // timestamp before the first transition and preserve it through every attempt.
    const beforeClaim = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { isLegacy: true, updatedAt: true },
    });
    const legacyTimestamp = beforeClaim?.isLegacy
      ? { updatedAt: beforeClaim.updatedAt }
      : {};
    const claimed = await this.prisma.post.updateMany({
      where: {
        id: postId,
        status: 'PROCESSING',
        processingVersion: version,
        processingAttempts: { lt: 3 },
        OR: [
          { processingStartedAt: null },
          {
            processingStartedAt: {
              lt: new Date(Date.now() - PROCESSING_LEASE_MS),
            },
          },
        ],
      },
      data: {
        processingStartedAt: new Date(),
        processingAttempts: { increment: 1 },
        ...legacyTimestamp,
      },
    });
    if (!claimed.count) {
      // A hard kill during the final allowed attempt must also terminate eventually.
      await this.prisma.post.updateMany({
        where: {
          id: postId,
          status: 'PROCESSING',
          processingVersion: version,
          processingAttempts: { gte: 3 },
          OR: [
            { processingStartedAt: null },
            {
              processingStartedAt: {
                lt: new Date(Date.now() - PROCESSING_LEASE_MS),
              },
            },
          ],
        },
        data: {
          status: 'FAILED',
          errorCode: 'PROCESSING_FAILED',
          processingStartedAt: null,
          ...legacyTimestamp,
        },
      });
      return;
    }
    const row = await this.prisma.post.findUnique({ where: { id: postId } });
    if (
      !row ||
      row.status !== 'PROCESSING' ||
      row.processingVersion !== version
    )
      return;
    let result: ProcessedMedia | undefined;
    try {
      result =
        row.isLegacy && row.mediaUrl
          ? await this.processor.processLegacy({
              postId,
              version,
              mediaType: row.mediaType,
              url: row.mediaUrl,
            })
          : await this.processor.process({
              postId,
              version,
              mediaType: row.mediaType,
              stagingKey: row.stagingKey!,
            });
      const published = await serializable(this.prisma, async (tx) => {
        const changed = await tx.post.updateMany({
          where: {
            id: postId,
            status: 'PROCESSING',
            processingVersion: version,
          },
          data: {
            status: 'READY',
            originalKey: result!.originalKey,
            largeKey: result!.largeKey,
            smallKey: result!.smallKey,
            playbackKey: result!.playbackKey,
            blurhash: result!.blurhash,
            width: result!.width,
            height: result!.height,
            byteSize: result!.byteSize,
            mimeType: result!.mimeType,
            duration: result!.duration,
            readyAt: new Date(),
            errorCode: null,
            stagingKey: null,
            multipartUploadId: null,
            processingStartedAt: null,
            mediaUrl: null,
            // @updatedAt would otherwise rewrite the legacy timeline during migration.
            ...(row.isLegacy ? { updatedAt: row.updatedAt } : {}),
          },
        });
        if (!changed.count) return false;
        if (row.stagingKey)
          await tx.mediaCleanup.create({
            data: {
              keys: [row.stagingKey],
              createdAt: new Date(Date.now() + SIGNED_UPLOAD_GRACE_MS),
            },
          });
        if (!row.isLegacy) {
          const current = await tx.post.findUniqueOrThrow({
            where: { id: postId },
            select: {
              author: { select: { name: true } },
              stamp: { select: { genre: { select: { tripId: true } } } },
            },
          });
          const label = row.mediaType === 'IMAGE' ? '写真' : '動画';
          await notifyMembers(
            tx,
            row.authorId,
            current.stamp.genre.tripId,
            `${label}が追加されました`,
            `${current.author.name ?? '仲間'}が${label}を追加しました`,
            { type: row.mediaType === 'IMAGE' ? 'photo' : 'video', postId },
          );
        }
        return true;
      });
      if (!published) await this.enqueueResultCleanup(result);
    } catch (error) {
      if (result) await this.enqueueResultCleanup(result);
      const code = this.errorCode(error);
      const retryable =
        code === 'PROCESSING_FAILED' && row.processingAttempts < 3;
      const changed = await this.prisma.post.updateMany({
        where: { id: postId, status: 'PROCESSING', processingVersion: version },
        data: {
          status: retryable ? 'PROCESSING' : 'FAILED',
          processingStartedAt: null,
          errorCode: code,
          ...legacyTimestamp,
        },
      });
      this.logger.warn(`Media processing failed for ${postId}: ${code}`);
      if (retryable && changed.count) throw error;
    }
  }

  async migrateLegacy(postId: string): Promise<void> {
    const legacy = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!legacy?.isLegacy) return;
    await this.prisma.post.updateMany({
      where: {
        id: postId,
        isLegacy: true,
        status: { in: ['LEGACY', 'FAILED'] },
      },
      data: {
        status: 'PROCESSING',
        processingVersion: { increment: 1 },
        processingAttempts: 0,
        processingStartedAt: null,
        errorCode: null,
        updatedAt: legacy.updatedAt,
      },
    });
    const row = await this.prisma.post.findUnique({ where: { id: postId } });
    if (row?.isLegacy && row.status === 'PROCESSING')
      await this.process(row.id, row.processingVersion);
  }

  /** Durable reconciliation runs in the dedicated worker, independent of API requests. */
  async cleanup(): Promise<void> {
    // Queue-send and DB commits cannot be atomic across pg-boss and Prisma. PROCESSING
    // rows are the outbox, so a crash at any point in complete/retry is recoverable.
    const waiting = await this.prisma.post.findMany({
      where: {
        status: 'PROCESSING',
        OR: [
          { processingStartedAt: null },
          {
            processingStartedAt: {
              lt: new Date(Date.now() - PROCESSING_LEASE_MS),
            },
          },
        ],
      },
      select: { id: true, processingVersion: true },
      take: 100,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
    });
    for (const post of waiting) {
      try {
        await this.queue.enqueueProcess(post.id, post.processingVersion);
      } catch {
        this.logger.warn('Media queue unavailable during recovery');
        break;
      }
    }
    const expired = await this.prisma.post.findMany({
      where: {
        status: { in: ['PENDING', 'FAILED'] },
        isLegacy: false,
        uploadExpiresAt: { lt: new Date() },
      },
      take: 100,
      orderBy: [{ uploadExpiresAt: 'asc' }, { id: 'asc' }],
    });
    for (const post of expired)
      await serializable(this.prisma, async (tx) => {
        const changed = await tx.post.updateMany({
          where: {
            id: post.id,
            status: post.status,
            processingVersion: post.processingVersion,
          },
          data: {
            status: 'FAILED',
            errorCode: 'UPLOAD_EXPIRED',
            uploadExpiresAt: null,
            processingStartedAt: null,
          },
        });
        if (changed.count && post.stagingKey)
          await tx.mediaCleanup.create({
            data: {
              keys: [post.stagingKey],
              multipartKey: post.stagingKey,
              multipartUploadId: post.multipartUploadId,
              createdAt: new Date(Date.now() + SIGNED_UPLOAD_GRACE_MS),
            },
          });
      });
    const cleanup = await this.prisma.mediaCleanup.findMany({
      where: { createdAt: { lte: new Date() } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    for (const entry of cleanup) {
      try {
        if (entry.multipartKey && entry.multipartUploadId)
          await this.storage.abortMultipart(
            entry.multipartKey,
            entry.multipartUploadId,
          );
        const referenced = await this.prisma.post.findMany({
          where: {
            OR: [
              { originalKey: { in: entry.keys } },
              { largeKey: { in: entry.keys } },
              { smallKey: { in: entry.keys } },
              { playbackKey: { in: entry.keys } },
            ],
          },
          select: {
            originalKey: true,
            largeKey: true,
            smallKey: true,
            playbackKey: true,
          },
        });
        const protectedKeys = new Set(
          referenced.flatMap((post) => Object.values(post)),
        );
        await this.storage.delete(
          entry.keys.filter((key) => !protectedKeys.has(key)),
        );
        await this.prisma.mediaCleanup.deleteMany({ where: { id: entry.id } });
      } catch {
        this.logger.warn(`Media cleanup deferred for ${entry.id}`);
      }
    }
    // Immutable attempt keys can be orphaned by a hard process termination before
    // the result reaches the DB. Scan one page per sweep, never deleting recent work.
    try {
      this.orphanCursor = await this.cleanOrphanPage(
        'media/',
        this.orphanCursor,
      );
      this.stagingCursor = await this.cleanOrphanPage(
        'staging/',
        this.stagingCursor,
      );
    } catch {
      this.logger.warn('Media orphan sweep deferred');
    }
  }

  private async cleanOrphanPage(prefix: string, cursor?: string) {
    const page = await this.storage.listObjects(prefix, cursor);
    const old = page.objects.filter(
      (item) => item.lastModified.getTime() < Date.now() - 48 * 60 * 60_000,
    );
    if (old.length) {
      const keys = old.map((item) => item.key);
      const referenced = await this.prisma.post.findMany({
        where: {
          OR: [
            { originalKey: { in: keys } },
            { largeKey: { in: keys } },
            { smallKey: { in: keys } },
            { playbackKey: { in: keys } },
            {
              stagingKey: { in: keys },
              status: { in: ['PENDING', 'PROCESSING'] },
            },
          ],
        },
        select: {
          originalKey: true,
          largeKey: true,
          smallKey: true,
          playbackKey: true,
          stagingKey: true,
        },
      });
      const used = new Set(referenced.flatMap((row) => Object.values(row)));
      await this.storage.delete(keys.filter((key) => !used.has(key)));
    }
    return page.cursor;
  }

  private async enqueueResultCleanup(result: ProcessedMedia) {
    await this.prisma.mediaCleanup.create({
      data: {
        keys: [
          result.originalKey,
          result.largeKey,
          result.smallKey,
          result.playbackKey,
        ].filter((key): key is string => !!key),
      },
    });
  }

  private errorCode(error: unknown): string {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String(error.code)
        : error instanceof Error && error.message === 'MEDIA_SIZE_EXCEEDED'
          ? error.message
          : '';
    return /^(MEDIA_SIZE_EXCEEDED|INVALID_IMAGE|ANIMATED_IMAGE_UNSUPPORTED|UNSUPPORTED_IMAGE_FORMAT|INVALID_VIDEO|UNSUPPORTED_VIDEO_FORMAT|VIDEO_DURATION_EXCEEDED|INVALID_VIDEO_DIMENSIONS|INVALID_VIDEO_POSTER|LEGACY_[A-Z_]+)$/.test(
      code,
    )
      ? code
      : 'PROCESSING_FAILED';
  }
}
