import { activePost } from '../database/active-records.js';
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
import { Prisma, type Post } from '../generated/prisma/client.js';
import { TripAccessService } from '../trips/trip-access.service.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { MediaQueue } from '../media-processing/media-queue.service.js';
import type {
  CompleteUploadDto,
  CreateUploadBatchDto,
} from './dto/uploads.dto.js';
import {
  IMAGE_MAX_BYTES,
  VIDEO_MAX_BYTES,
  MULTIPART_PART_SIZE,
  UPLOAD_LIFETIME_MS,
  validateUploadFiles,
} from './upload-policy.js';

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TripAccessService,
    private readonly storage: ObjectStorageService,
    private readonly queue: MediaQueue,
  ) {}

  async createBatch(userId: string, dto: CreateUploadBatchDto) {
    await this.access.requireStamp(userId, dto.stampId);
    validateUploadFiles(dto.files);
    if (dto.clientRequestId) {
      const existing = await this.prisma.uploadBatch.findUnique({
        where: {
          authorId_clientRequestId: {
            authorId: userId,
            clientRequestId: dto.clientRequestId,
          },
        },
        include: { posts: true },
      });
      if (existing) {
        this.assertSameBatch(existing.posts, dto);
        return this.getBatch(userId, existing.id);
      }
    }
    let batchId: string;
    try {
      const batch = await this.prisma.uploadBatch.create({
        data: {
          authorId: userId,
          clientRequestId: dto.clientRequestId,
          posts: {
            create: dto.files.map((file) => {
              const id = randomUUID();
              return {
                id,
                stampId: dto.stampId,
                authorId: userId,
                clientId: file.clientId,
                mediaType: file.mediaType,
                fileName: file.fileName,
                mimeType: file.mimeType,
                byteSize: file.byteSize,
                status: 'PENDING' as const,
                stagingKey: `staging/${id}/${randomUUID()}`,
                uploadExpiresAt: new Date(Date.now() + UPLOAD_LIFETIME_MS),
              };
            }),
          },
        },
      });
      batchId = batch.id;
    } catch (error) {
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002' ||
        !dto.clientRequestId
      )
        throw error;
      const existing = await this.prisma.uploadBatch.findUniqueOrThrow({
        where: {
          authorId_clientRequestId: {
            authorId: userId,
            clientRequestId: dto.clientRequestId,
          },
        },
        include: { posts: true },
      });
      this.assertSameBatch(existing.posts, dto);
      batchId = existing.id;
    }
    return this.getBatch(userId, batchId);
  }

  async getBatch(userId: string, id: string) {
    const batch = await this.prisma.uploadBatch.findFirst({
      where: { id, authorId: userId },
      include: {
        posts: {
          where: activePost,
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
    if (!batch) throw new NotFoundException('Upload batch not found');
    // Removing a member also removes their access to pending uploads and URLs.
    for (const stampId of new Set(batch.posts.map((post) => post.stampId)))
      await this.access.requireStamp(userId, stampId);
    const uploads = [];
    for (const row of batch.posts) uploads.push(await this.toUpload(row));
    return { id: batch.id, uploads };
  }

  async signParts(userId: string, id: string, partNumbers: number[]) {
    const row = await this.requirePending(userId, id);
    if (row.mediaType !== 'VIDEO')
      throw new BadRequestException('Only videos use multipart upload');
    const total = Math.ceil(row.byteSize! / MULTIPART_PART_SIZE);
    if (partNumbers.some((part) => part > total))
      throw new BadRequestException('Part number exceeds file size');
    const uploadId = await this.ensureMultipart(row);
    return {
      parts: await Promise.all(
        partNumbers.map(async (partNumber) => ({
          partNumber,
          ...(await this.storage.signPart(
            row.stagingKey!,
            uploadId,
            partNumber,
          )),
        })),
      ),
    };
  }

  async listParts(userId: string, id: string) {
    const row = await this.requirePending(userId, id);
    if (row.mediaType !== 'VIDEO')
      throw new BadRequestException('Only videos use multipart upload');
    // CompleteMultipart may have succeeded just before an API crash. The finished
    // object is authoritative; no ListParts call can succeed for that old upload ID.
    const completed = await this.headIfPresent(row.stagingKey!);
    if (completed && completed.byteSize === row.byteSize)
      return { parts: [], completed: true };
    const uploadId = await this.ensureMultipart(row);
    return {
      parts: await this.storage.listParts(row.stagingKey!, uploadId),
      completed: false,
    };
  }

  async complete(userId: string, id: string, dto: CompleteUploadDto) {
    const row = await this.requireOwned(userId, id);
    if (row.status === 'READY') return this.toUpload(row);
    if (row.status === 'PROCESSING') {
      await this.enqueue(row);
      return this.toUpload(row);
    }
    this.assertPending(row);
    if (row.mediaType === 'VIDEO') {
      // A retry after R2 completed but before the DB transition can safely find the final object.
      const alreadyCompleted = await this.headIfPresent(row.stagingKey!);
      if (!alreadyCompleted) {
        if (!row.multipartUploadId || !dto.parts?.length)
          throw new BadRequestException(
            'Completed multipart parts are required',
          );
        const parts = await this.storage.listParts(
          row.stagingKey!,
          row.multipartUploadId,
        );
        const expectedParts = Math.ceil(row.byteSize! / MULTIPART_PART_SIZE);
        const ordered = [...parts].sort((a, b) => a.partNumber - b.partNumber);
        if (
          ordered.length !== expectedParts ||
          dto.parts.length !== expectedParts ||
          ordered.some(
            (part, index) =>
              part.partNumber !== index + 1 ||
              part.byteSize !==
                Math.min(
                  MULTIPART_PART_SIZE,
                  row.byteSize! - index * MULTIPART_PART_SIZE,
                ) ||
              !dto.parts!.some(
                (requested) =>
                  requested.partNumber === part.partNumber &&
                  requested.etag === part.etag,
              ),
          )
        )
          throw new BadRequestException(
            'Multipart parts do not match the expected file',
          );
        await this.storage.completeMultipart(
          row.stagingKey!,
          row.multipartUploadId,
          dto.parts,
        );
      }
    } else if (dto.parts?.length) {
      throw new BadRequestException('Images do not use multipart upload');
    }
    const object = await this.headIfPresent(row.stagingKey!);
    if (!object)
      throw new BadRequestException('Upload the file before completing it');
    const limit = row.mediaType === 'IMAGE' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (
      object.byteSize !== row.byteSize ||
      object.byteSize < 1 ||
      object.byteSize > limit
    ) {
      await this.prisma.post.updateMany({
        where: {
          id,
          status: 'PENDING',
          processingVersion: row.processingVersion,
        },
        data: { status: 'FAILED', errorCode: 'MEDIA_SIZE_EXCEEDED' },
      });
      throw new BadRequestException(
        'The stored file size does not match the upload',
      );
    }
    await this.prisma.post.updateMany({
      where: {
        id,
        status: 'PENDING',
        processingVersion: row.processingVersion,
      },
      data: {
        status: 'PROCESSING',
        multipartUploadId: null,
        processingStartedAt: null,
        processingAttempts: 0,
        processingVersion: { increment: 1 },
        errorCode: null,
      },
    });
    const current = await this.requireOwned(userId, id);
    if (current.status === 'PROCESSING') await this.enqueue(current);
    return this.toUpload(current);
  }

  async retry(userId: string, id: string) {
    const row = await this.requireOwned(userId, id);
    if (row.status === 'PROCESSING') {
      await this.enqueue(row);
      return this.toUpload(row);
    }
    if (
      row.status === 'READY' ||
      (row.status === 'PENDING' && !this.isExpired(row))
    )
      return this.toUpload(row);
    if (row.status !== 'FAILED' && row.status !== 'PENDING')
      throw new ConflictException('This upload cannot be retried');
    const canReuse =
      row.errorCode === 'PROCESSING_FAILED' &&
      row.stagingKey &&
      !this.isExpired(row) &&
      (await this.headIfPresent(row.stagingKey));
    await serializable(this.prisma, async (tx) => {
      const changed = await tx.post.updateMany({
        where: {
          id,
          status: row.status,
          processingVersion: row.processingVersion,
        },
        data: canReuse
          ? {
              status: 'PROCESSING',
              processingVersion: { increment: 1 },
              processingAttempts: 0,
              processingStartedAt: null,
              errorCode: null,
            }
          : {
              status: 'PENDING',
              stagingKey: `staging/${id}/${randomUUID()}`,
              multipartUploadId: null,
              uploadExpiresAt: new Date(Date.now() + UPLOAD_LIFETIME_MS),
              processingVersion: { increment: 1 },
              processingAttempts: 0,
              processingStartedAt: null,
              errorCode: null,
            },
      });
      if (changed.count && !canReuse && row.stagingKey)
        await tx.mediaCleanup.create({
          data: {
            keys: [row.stagingKey],
            multipartKey: row.stagingKey,
            multipartUploadId: row.multipartUploadId,
            // A previously signed PUT may still arrive for 15 minutes.
            createdAt: new Date(Date.now() + 20 * 60_000),
          },
        });
    });
    const current = await this.requireOwned(userId, id);
    if (current.status === 'PROCESSING') await this.enqueue(current);
    return this.toUpload(current);
  }

  async cancel(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await serializable(this.prisma, async (tx) => {
      const row = await tx.post.findUnique({ where: { id } });
      if (!row || row.status === 'CANCELLED') return;
      if (row.status === 'READY')
        throw new ConflictException(
          'Delete published media using DELETE /posts/:id',
        );
      await tx.post.update({
        where: { id },
        data: { status: 'CANCELLED', processingVersion: { increment: 1 } },
      });
      await tx.mediaCleanup.create({
        data: {
          keys: [
            row.stagingKey,
            row.originalKey,
            row.largeKey,
            row.smallKey,
            row.playbackKey,
          ].filter((key): key is string => !!key),
          multipartKey: row.stagingKey,
          multipartUploadId: row.multipartUploadId,
          createdAt: new Date(Date.now() + 20 * 60_000),
        },
      });
    });
  }

  private async requireOwned(userId: string, id: string): Promise<Post> {
    const row = await this.prisma.post.findFirst({
      where: {
        id,
        authorId: userId,
        uploadBatchId: { not: null },
        ...activePost,
      },
    });
    if (!row) throw new NotFoundException('Upload not found');
    await this.access.requireStamp(userId, row.stampId);
    return row;
  }

  private async requirePending(userId: string, id: string) {
    const row = await this.requireOwned(userId, id);
    this.assertPending(row);
    return row;
  }

  private isExpired(row: Post) {
    return !row.uploadExpiresAt || row.uploadExpiresAt.getTime() <= Date.now();
  }

  private assertPending(row: Post) {
    if (row.status !== 'PENDING')
      throw new ConflictException('Upload is not pending');
    if (this.isExpired(row))
      throw new ConflictException(
        'Upload expired; retry to start a new upload',
      );
  }

  private async ensureMultipart(row: Post) {
    if (row.multipartUploadId) return row.multipartUploadId;
    const uploadId = await this.storage.createMultipart(
      row.stagingKey!,
      row.mimeType!,
    );
    const changed = await this.prisma.post.updateMany({
      where: {
        id: row.id,
        status: 'PENDING',
        stagingKey: row.stagingKey,
        multipartUploadId: null,
      },
      data: { multipartUploadId: uploadId },
    });
    if (changed.count) return uploadId;
    await this.storage.abortMultipart(row.stagingKey!, uploadId);
    const current = await this.prisma.post.findUnique({
      where: { id: row.id },
    });
    if (
      current?.status === 'PENDING' &&
      current.stagingKey === row.stagingKey &&
      current.multipartUploadId
    )
      return current.multipartUploadId;
    throw new ConflictException('Upload state changed; refresh the batch');
  }

  private async toUpload(row: Post) {
    let upload:
      | { kind: 'single'; url: string; expiresAt: string }
      | { kind: 'multipart'; partSize: number }
      | null = null;
    if (row.status === 'PENDING' && !this.isExpired(row)) {
      if (row.mediaType === 'IMAGE') {
        upload = {
          kind: 'single',
          ...(await this.storage.signPut(
            row.stagingKey!,
            row.mimeType!,
            row.byteSize!,
          )),
        };
      } else {
        await this.ensureMultipart(row);
        upload = { kind: 'multipart', partSize: MULTIPART_PART_SIZE };
      }
    }
    return {
      id: row.id,
      clientId: row.clientId,
      status: row.status,
      mediaType: row.mediaType,
      fileName: row.fileName,
      byteSize: row.byteSize,
      errorCode:
        row.status === 'PENDING' && this.isExpired(row)
          ? 'UPLOAD_EXPIRED'
          : row.errorCode,
      upload,
    };
  }

  private async headIfPresent(key: string) {
    try {
      return await this.storage.head(key);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        (('name' in error &&
          ['NotFound', 'NoSuchKey'].includes(String(error.name))) ||
          ('$metadata' in error &&
            (error.$metadata as { httpStatusCode?: number })?.httpStatusCode ===
              404))
      )
        return null;
      throw error;
    }
  }

  private async enqueue(row: Post) {
    try {
      await this.queue.enqueueProcess(row.id, row.processingVersion);
    } catch {
      // PROCESSING itself is a durable outbox; the worker's sweeper repairs enqueue failures.
      this.logger.warn(
        `Media queue unavailable; upload ${row.id} will be recovered by the sweeper`,
      );
    }
  }

  private assertSameBatch(posts: Post[], dto: CreateUploadBatchDto) {
    if (
      posts.length !== dto.files.length ||
      dto.files.some(
        (file) =>
          !posts.some(
            (post) =>
              post.clientId === file.clientId &&
              post.stampId === dto.stampId &&
              post.mediaType === file.mediaType &&
              post.fileName === file.fileName &&
              post.byteSize === file.byteSize,
          ),
      )
    )
      throw new ConflictException(
        'clientRequestId was already used for another batch',
      );
  }
}
