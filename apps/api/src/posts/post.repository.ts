import { genreMemberships } from '../stamps/stamp-genres.js';
import { serializable } from '../database/transaction.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ListPostsDto, PostScope } from './dto/list-posts.dto.js';
import { Post } from './entities/post.entity.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';

const postInclude = (userId: string) =>
  ({
    reads: { where: { userId }, select: { readAt: true } },
    author: { select: { id: true, name: true } },
    stamp: { select: { tripId: true, genres: genreMemberships } },
  }) satisfies Prisma.PostInclude;

type PostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof postInclude>;
}>;

@Injectable()
export class PostRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}

  async original(id: string, userId: string) {
    const row = await this.prisma.post.findFirst({
      where: {
        id,
        status: 'READY',
        stamp: { trip: { members: { some: { userId } } } },
      },
    });
    if (!row?.originalKey)
      throw new NotFoundException('Original not available');
    const fileName = row.fileName ?? `original-${row.id}`;
    return {
      ...(await this.storage.signGet(row.originalKey, {
        downloadName: fileName,
      })),
      mimeType: row.mimeType,
      fileName,
    };
  }

  async findById(id: string, userId: string): Promise<Post | null> {
    const row = await this.prisma.post.findFirst({
      where: {
        id,
        status: 'READY',
        stamp: { trip: { members: { some: { userId } } } },
      },
      include: postInclude(userId),
    });
    return row ? this.toDomain(row) : null;
  }

  async list(scope: PostScope, query: ListPostsDto, userId: string) {
    const scopeWhere: Prisma.PostWhereInput =
      scope.type === 'trip'
        ? { stamp: { tripId: scope.id } }
        : scope.type === 'genre'
          ? { stamp: { genres: { some: { genreId: scope.id } } } }
          : { stampId: scope.id };
    const rows = await this.prisma.post.findMany({
      where: {
        ...scopeWhere,
        status: 'READY',
        mediaType: query.mediaType,
        ...(query.favoritesOnly === true ? { isFavorite: true } : {}),
        ...paginationWhere(query, 'desc'),
      },
      include: postInclude(userId),
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    return paginate(
      await Promise.all(rows.map((row) => this.toDomain(row))),
      query.limit,
    );
  }

  async setFavorite(
    id: string,
    isFavorite: boolean,
    userId: string,
  ): Promise<Post> {
    return serializable(this.prisma, async (tx) => {
      const changed = await tx.post.updateMany({
        where: {
          id,
          status: 'READY',
          stamp: { trip: { members: { some: { userId } } } },
        },
        data: { isFavorite },
      });
      if (!changed.count) throw new NotFoundException('Post not found');
      const row = await tx.post.findUniqueOrThrow({
        where: { id },
        include: postInclude(userId),
      });
      return this.toDomain(row);
    });
  }

  async markRead(id: string, userId: string): Promise<Post> {
    return serializable(this.prisma, async (tx) => {
      const visible = await tx.post.findFirst({
        where: {
          id,
          status: 'READY',
          stamp: { trip: { members: { some: { userId } } } },
        },
        select: { id: true },
      });
      if (!visible) throw new NotFoundException('Post not found');
      // Empty update preserves the first timestamp, including concurrent retries.
      await tx.photoRead.upsert({
        where: { userId_postId: { userId, postId: id } },
        create: { userId, postId: id },
        update: {},
      });
      const row = await tx.post.findUniqueOrThrow({
        where: { id, status: 'READY' },
        include: postInclude(userId),
      });
      return this.toDomain(row);
    });
  }

  async delete(id: string): Promise<void> {
    // Unpublished uploads have a separate author-only cancellation endpoint.
    // The status predicate and deletion are atomic, including concurrent publication.
    await serializable(this.prisma, async (tx) => {
      const deleted = await tx.post.deleteMany({
        where: { id, status: 'READY' },
      });
      if (!deleted.count) throw new NotFoundException('Post not found');
      // Foreign keys remove reads/notifications; the DB trigger queues object cleanup.
    });
  }

  private async toDomain(row: PostRecord): Promise<Post> {
    if (
      !row.smallKey ||
      !row.largeKey ||
      (row.mediaType === 'VIDEO' && !row.playbackKey)
    )
      throw new NotFoundException('Media is not ready');
    const [small, large, playback] = await Promise.all([
      this.storage.signGet(row.smallKey),
      this.storage.signGet(row.largeKey),
      row.playbackKey ? this.storage.signGet(row.playbackKey) : null,
    ]);
    return new Post(
      row.id,
      row.stampId,
      row.stamp.genres.map(({ genreId }) => genreId),
      row.stamp.tripId,
      row.author,
      row.mediaType,
      row.mediaType === 'IMAGE' ? large.url : playback!.url,
      row.isFavorite,
      row.createdAt,
      row.updatedAt,
      row.reads[0]?.readAt ?? null,
      small.url,
      large.url,
      playback?.url ?? null,
      row.blurhash,
      row.width,
      row.height,
      row.duration === null ? null : row.duration * 1000,
      'READY',
      row.mimeType,
      row.fileName,
    );
  }
}
