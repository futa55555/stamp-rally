import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../database/prisma.service.js';
import { serializable } from '../database/transaction.js';
import { Prisma, type CoverAsset } from '../generated/prisma/client.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import {
  InvalidMediaError,
  MediaProcessor,
} from '../media-processing/media-processor.service.js';
import { MediaQueue } from '../media-processing/media-queue.service.js';

const LIFETIME = 24 * 60 * 60_000;
const LEASE = 2 * 60 * 60_000;
const GRACE = 20 * 60_000;

@Injectable()
export class CoverAssetsService {
  private readonly logger = new Logger(CoverAssetsService.name);
  private orphanCursor?: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
    private readonly processor: MediaProcessor,
    private readonly queue: MediaQueue,
  ) {}

  async create(
    userId: string,
    input: { clientRequestId: string; byteSize: number; mimeType: string },
  ) {
    const id = randomUUID();
    const where = {
      authorId_clientRequestId: {
        authorId: userId,
        clientRequestId: input.clientRequestId,
      },
    };
    const row = await this.prisma.coverAsset
      .upsert({
        where: {
          authorId_clientRequestId: {
            authorId: userId,
            clientRequestId: input.clientRequestId,
          },
        },
        create: {
          ...input,
          id,
          authorId: userId,
          stagingKey: `covers/staging/${id}/${randomUUID()}`,
          expiresAt: new Date(Date.now() + LIFETIME),
        },
        update: {},
      })
      .catch(async (error: unknown) => {
        if (
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
        // Prisma can implement an empty-update upsert as read/create. A concurrent
        // first request may win; replay its asset instead of creating a second one.
        return this.prisma.coverAsset.findUniqueOrThrow({ where });
      });
    if (row.byteSize !== input.byteSize || row.mimeType !== input.mimeType)
      throw new ConflictException(
        'Upload request already exists with different image metadata',
      );
    return this.present(row);
  }

  async get(userId: string, id: string) {
    return this.present(await this.owned(userId, id));
  }

  async complete(userId: string, id: string) {
    const row = await this.owned(userId, id);
    if (row.status === 'READY') return this.present(row);
    if (row.status === 'PENDING') {
      this.assertUnexpired(row);
      const metadata = await this.storage.head(row.stagingKey!);
      if (
        metadata.byteSize !== row.byteSize ||
        metadata.contentType !== row.mimeType
      )
        throw new BadRequestException(
          'Uploaded image size or type does not match',
        );
      await this.prisma.coverAsset.updateMany({
        where: {
          id,
          authorId: userId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
        data: { status: 'PROCESSING' },
      });
    } else if (row.status !== 'PROCESSING') {
      throw new ConflictException(
        'Select the image again to retry this upload',
      );
    }
    const current = await this.owned(userId, id);
    if (current.status === 'PROCESSING') await this.queue.enqueueCover(id);
    return this.present(current);
  }

  async cancel(userId: string, id: string) {
    await serializable(this.prisma, async (tx) => {
      const row = await tx.coverAsset.findFirst({
        where: { id, authorId: userId },
        include: { trip: { select: { id: true } } },
      });
      if (!row) return;
      if (row.trip)
        throw new ConflictException('Remove the cover from the trip first');
      await tx.coverAsset.delete({ where: { id } });
    });
  }

  // Called inside the trip transaction, so cancellation/expiry/another attachment
  // cannot race the permission check and leave a dangling cover.
  async assertAttachable(
    tx: Prisma.TransactionClient,
    userId: string,
    id: string,
    tripId?: string,
  ) {
    const row = await tx.coverAsset.findUnique({
      where: { id },
      include: { trip: { select: { id: true } } },
    });
    if (!row) throw new NotFoundException('Cover image not found');
    if (row.trip?.id === tripId && tripId) return;
    if (row.authorId !== userId)
      throw new NotFoundException('Cover image not found');
    if (row.trip)
      throw new ConflictException('Cover image is already attached');
    this.assertUnexpired(row);
    if (row.status !== 'READY' || !row.imageKey)
      throw new ConflictException('Cover image is not ready');
  }

  async process(id: string) {
    const available = {
      OR: [
        { processingStartedAt: null },
        { processingStartedAt: { lt: new Date(Date.now() - LEASE) } },
      ],
    };
    const claim = await this.prisma.coverAsset.updateMany({
      where: {
        id,
        status: 'PROCESSING',
        processingAttempts: { lt: 3 },
        ...available,
      },
      data: {
        processingStartedAt: new Date(),
        processingAttempts: { increment: 1 },
      },
    });
    if (!claim.count) {
      await this.prisma.coverAsset.updateMany({
        where: {
          id,
          status: 'PROCESSING',
          processingAttempts: { gte: 3 },
          ...available,
        },
        data: {
          status: 'FAILED',
          errorCode: 'PROCESSING_FAILED',
          processingStartedAt: null,
        },
      });
      return;
    }
    const row = await this.prisma.coverAsset.findUnique({ where: { id } });
    if (!row || row.status !== 'PROCESSING' || !row.stagingKey) return;
    const attempt = row.processingAttempts;
    let result: Awaited<ReturnType<MediaProcessor['processCover']>> | undefined;
    try {
      result = await this.processor.processCover(id, attempt, row.stagingKey);
      const published = await serializable(this.prisma, async (tx) => {
        const changed = await tx.coverAsset.updateMany({
          where: { id, status: 'PROCESSING', processingAttempts: attempt },
          data: {
            ...result,
            status: 'READY',
            stagingKey: null,
            processingStartedAt: null,
            errorCode: null,
          },
        });
        if (changed.count)
          await tx.mediaCleanup.create({
            data: {
              keys: [row.stagingKey!],
              createdAt: new Date(Date.now() + GRACE),
            },
          });
        return changed.count > 0;
      });
      if (!published)
        await this.prisma.mediaCleanup.create({
          data: { keys: [result.imageKey] },
        });
    } catch (error) {
      if (result)
        await this.prisma.mediaCleanup.create({
          data: { keys: [result.imageKey] },
        });
      const retry = !(error instanceof InvalidMediaError) && attempt < 3;
      const code =
        error instanceof InvalidMediaError ? error.code : 'PROCESSING_FAILED';
      const changed = await this.prisma.coverAsset.updateMany({
        where: { id, status: 'PROCESSING', processingAttempts: attempt },
        data: {
          status: retry ? 'PROCESSING' : 'FAILED',
          processingStartedAt: null,
          errorCode: code,
        },
      });
      this.logger.warn(`Cover processing failed for ${id}: ${code}`);
      if (retry && changed.count) throw error;
    }
  }

  async cleanup() {
    await serializable(this.prisma, async (tx) => {
      const expired = await tx.coverAsset.findMany({
        where: { trip: null, expiresAt: { lt: new Date() } },
        take: 100,
        orderBy: [{ expiresAt: 'asc' }, { id: 'asc' }],
      });
      await tx.coverAsset.deleteMany({
        where: { id: { in: expired.map((row) => row.id) }, trip: null },
      });
    });
    const pending = await this.prisma.coverAsset.findMany({
      where: {
        status: 'PROCESSING',
        OR: [
          { processingStartedAt: null },
          { processingStartedAt: { lt: new Date(Date.now() - LEASE) } },
        ],
      },
      take: 100,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    for (const row of pending) await this.queue.enqueueCover(row.id);
    try {
      const page = await this.storage.listObjects('covers/', this.orphanCursor);
      const keys = page.objects
        .filter(
          (item) => item.lastModified.getTime() < Date.now() - 48 * 60 * 60_000,
        )
        .map((item) => item.key);
      if (keys.length) {
        const rows = await this.prisma.coverAsset.findMany({
          where: {
            OR: [{ imageKey: { in: keys } }, { stagingKey: { in: keys } }],
          },
          select: { imageKey: true, stagingKey: true },
        });
        const used = new Set(rows.flatMap((row) => Object.values(row)));
        await this.storage.delete(keys.filter((key) => !used.has(key)));
      }
      this.orphanCursor = page.cursor;
    } catch {
      this.logger.warn('Cover orphan cleanup deferred');
    }
  }

  private async owned(userId: string, id: string) {
    const row = await this.prisma.coverAsset.findFirst({
      where: { id, authorId: userId },
    });
    if (!row) throw new NotFoundException('Cover image not found');
    return row;
  }

  private assertUnexpired(row: CoverAsset) {
    if (row.expiresAt.getTime() <= Date.now())
      throw new ConflictException('Cover upload expired');
  }

  private async present(row: CoverAsset) {
    const expired = row.expiresAt.getTime() <= Date.now();
    return {
      id: row.id,
      status: row.status,
      errorCode:
        expired && row.status !== 'READY' ? 'UPLOAD_EXPIRED' : row.errorCode,
      expiresAt: row.expiresAt.toISOString(),
      upload:
        row.status === 'PENDING' && !expired && row.stagingKey
          ? await this.storage.signPut(
              row.stagingKey,
              row.mimeType,
              row.byteSize,
            )
          : null,
    };
  }
}
