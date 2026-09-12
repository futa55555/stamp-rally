import { restorablePosts, trashExpiresAt } from './trash-policy.js';
import { trashAfter, trashCursor, trashOrder } from './trash-pagination.js';
import type { PaginationQueryDto } from '../common/pagination.js';
import { memberPost, visiblePost } from '../database/active-records.js';
import { categoryMemberships } from '../stamps/stamp-categories.js';
import { serializable } from '../database/transaction.js';
import { GoneException, Injectable, NotFoundException } from '@nestjs/common';
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
    stamp: { select: { tripId: true, categories: categoryMemberships } },
  }) satisfies Prisma.PostInclude;

type PostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof postInclude>;
}>;

const trashInclude = (userId: string) =>
  ({
    ...postInclude(userId),
    stamp: {
      select: {
        tripId: true,
        name: true,
        categories: categoryMemberships,
        trip: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            createdAt: true,
          },
        },
      },
    },
  }) satisfies Prisma.PostInclude;
type TrashRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof trashInclude>;
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
        ...memberPost(userId),
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
        ...memberPost(userId),
      },
      include: postInclude(userId),
    });
    return row ? this.toDomain(row) : null;
  }

  async list(scope: PostScope, query: ListPostsDto, userId: string) {
    const scopeWhere: Prisma.PostWhereInput =
      scope.type === 'trip'
        ? { stamp: { tripId: scope.id } }
        : scope.type === 'category'
          ? { stamp: { categories: { some: { categoryId: scope.id } } } }
          : { stampId: scope.id };
    const rows = await this.prisma.post.findMany({
      where: {
        AND: [scopeWhere, memberPost(userId)],
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
          ...memberPost(userId),
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
          ...memberPost(userId),
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
        where: { id, ...visiblePost },
        include: postInclude(userId),
      });
      return this.toDomain(row);
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    await serializable(this.prisma, async (tx) => {
      const row = await tx.post.findFirst({
        where: { ...memberPost(userId), id, deletedAt: undefined },
      });
      if (!row) throw new NotFoundException('Post not found');
      // Retrying a trash operation never extends its restoration deadline.
      if (row.deletedAt) return;
      await tx.post.update({ where: { id }, data: { deletedAt: new Date() } });
    });
  }

  async trash(userId: string, query: PaginationQueryDto) {
    const rows = await this.prisma.post.findMany({
      where: { AND: [restorablePosts(userId), trashAfter(query.cursor)] },
      include: trashInclude(userId),
      orderBy: trashOrder,
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit);
    return {
      items: await Promise.all(items.map((row) => this.toTrash(row))),
      nextCursor:
        rows.length > query.limit && items.length
          ? trashCursor(items[items.length - 1])
          : null,
    };
  }

  async trashDetail(id: string, userId: string) {
    const row = await this.prisma.post.findFirst({
      where: { id, ...restorablePosts(userId) },
      include: trashInclude(userId),
    });
    if (!row) throw new NotFoundException('Trashed post not found');
    return this.toTrash(row);
  }

  async restore(id: string, userId: string): Promise<Post> {
    return serializable(this.prisma, async (tx) => {
      const row = await tx.post.findFirst({
        where: { ...memberPost(userId), id, deletedAt: undefined },
        include: postInclude(userId),
      });
      if (!row) throw new NotFoundException('Post not found');
      if (!row.deletedAt) return this.toDomain(row);
      if (trashExpiresAt(row.deletedAt).getTime() <= Date.now())
        throw new GoneException('復元できる30日間を過ぎています。');
      const restored = await tx.post.update({
        where: { id },
        data: { deletedAt: null },
        include: postInclude(userId),
      });
      return this.toDomain(restored);
    });
  }

  private async toTrash(row: TrashRecord) {
    const trip = row.stamp.trip;
    return {
      ...(await this.toDomain(row)),
      deletedAt: row.deletedAt!.toISOString(),
      expiresAt: trashExpiresAt(row.deletedAt!).toISOString(),
      stampName: row.stamp.name,
      trip: {
        id: trip.id,
        name: trip.name,
        startDate: trip.startDate.toISOString().slice(0, 10),
        endDate: trip.endDate.toISOString().slice(0, 10),
      },
    };
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
      row.stamp.categories.map(({ categoryId }) => categoryId),
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
