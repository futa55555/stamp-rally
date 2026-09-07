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

const postInclude = {
  author: { select: { id: true, name: true } },
  stamp: { select: { genreId: true, genre: { select: { tripId: true } } } },
} satisfies Prisma.PostInclude;

type PostRecord = Prisma.PostGetPayload<{ include: typeof postInclude }>;

@Injectable()
export class PostRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    stampId: string;
    authorId: string;
    mediaType: MediaType;
    mediaUrl: string;
  }): Promise<Post> {
    const row = await this.prisma.post.create({
      data: { ...data, isFavorite: false },
      include: postInclude,
    });
    return this.toDomain(row);
  }

  async findById(id: string): Promise<Post | null> {
    const row = await this.prisma.post.findUnique({
      where: { id },
      include: postInclude,
    });
    return row ? this.toDomain(row) : null;
  }

  async list(scope: PostScope, query: ListPostsDto) {
    const scopeWhere: Prisma.PostWhereInput =
      scope.type === 'trip'
        ? { stamp: { genre: { tripId: scope.id } } }
        : scope.type === 'genre'
          ? { stamp: { genreId: scope.id } }
          : { stampId: scope.id };
    const rows = await this.prisma.post.findMany({
      where: {
        ...scopeWhere,
        ...(query.favoritesOnly === true ? { isFavorite: true } : {}),
        ...paginationWhere(query, 'desc'),
      },
      include: postInclude,
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    return paginate(
      rows.map((row) => this.toDomain(row)),
      query.limit,
    );
  }

  async setFavorite(id: string, isFavorite: boolean): Promise<Post> {
    const row = await this.prisma.post.update({
      where: { id },
      data: { isFavorite },
      include: postInclude,
    });
    return this.toDomain(row);
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
    );
  }
}
