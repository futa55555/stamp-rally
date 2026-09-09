import { notifyMembers } from '../notifications/notify.js';
import { serializable } from '../database/transaction.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { MediaType } from '../generated/prisma/enums.js';
import type { ListPostsDto, PostScope } from './dto/list-posts.dto.js';
import { Post } from './entities/post.entity.js';

const postInclude = (userId: string) =>
  ({
    reads: { where: { userId }, select: { readAt: true } },
    author: { select: { id: true, name: true } },
    stamp: { select: { genreId: true, genre: { select: { tripId: true } } } },
  }) satisfies Prisma.PostInclude;

type PostRecord = Prisma.PostGetPayload<{
  include: ReturnType<typeof postInclude>;
}>;

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    stampId: string;
    authorId: string;
    mediaType: MediaType;
    mediaUrl: string;
  }): Promise<Post> {
    return serializable(this.prisma, async (tx) => {
      const row = await tx.post.create({
        data: { ...data, isFavorite: false },
        include: postInclude(data.authorId),
      });
      if (row.mediaType === 'IMAGE')
        await notifyMembers(
          tx,
          data.authorId,
          row.stamp.genre.tripId,
          '写真が追加されました',
          `${row.author.name ?? '仲間'}が写真を追加しました`,
          { type: 'photo', postId: row.id },
        );
      return this.toDomain(row);
    });
  }

  async findById(id: string, userId: string): Promise<Post | null> {
    const row = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude(userId),
    });
    return row ? this.toDomain(row) : null;
  }

  async list(scope: PostScope, query: ListPostsDto, userId: string) {
    const scopeWhere: Prisma.PostWhereInput =
      scope.type === 'trip'
        ? { stamp: { genre: { tripId: scope.id } } }
        : scope.type === 'genre'
          ? { stamp: { genreId: scope.id } }
          : { stampId: scope.id };
    const rows = await this.prisma.post.findMany({
      where: {
        ...scopeWhere,
        mediaType: query.mediaType,
        ...(query.favoritesOnly === true ? { isFavorite: true } : {}),
        ...paginationWhere(query, 'desc'),
      },
      include: postInclude(userId),
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    return paginate(
      rows.map((row) => this.toDomain(row)),
      query.limit,
    );
  }

  async setFavorite(
    id: string,
    isFavorite: boolean,
    userId: string,
  ): Promise<Post> {
    const row = await this.prisma.post.update({
      where: { id },
      data: { isFavorite },
      include: postInclude(userId),
    });
    return this.toDomain(row);
  }

  async markRead(id: string, userId: string): Promise<Post> {
    return serializable(this.prisma, async (tx) => {
      // Empty update preserves the first timestamp, including concurrent retries.
      await tx.photoRead.upsert({
        where: { userId_postId: { userId, postId: id } },
        create: { userId, postId: id },
        update: {},
      });
      const row = await tx.post.findUniqueOrThrow({
        where: { id },
        include: postInclude(userId),
      });
      return this.toDomain(row);
    });
  }

  async delete(id: string): Promise<void> {
    // Foreign keys remove per-user reads and photo notifications atomically.
    await this.prisma.post.delete({ where: { id } });
  }

  private toDomain(row: PostRecord): Post {
    return new Post(
      row.id,
      row.stampId,
      row.stamp.genreId,
      row.stamp.genre.tripId,
      row.author,
      row.mediaType,
      row.mediaUrl,
      row.isFavorite,
      row.createdAt,
      row.updatedAt,
      row.reads[0]?.readAt ?? null,
    );
  }
}
