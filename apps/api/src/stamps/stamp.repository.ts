import { notifyMembers } from '../notifications/notify.js';
import { serializable } from '../database/transaction.js';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import {
  Prisma,
  type Stamp as PrismaStamp,
} from '../generated/prisma/client.js';
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { ListStampsDto } from './dto/list-stamps.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';
import { Stamp } from './entities/stamp.entity.js';

const completion = {
  _count: { select: { posts: { where: { mediaType: 'IMAGE' as const } } } },
  posts: { take: 1, select: { id: true } },
  // A separate filtered relation is queried in bulk for unread state below.
} as const;

@Injectable()
export class StampRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStampDto, userId: string): Promise<Stamp> {
    return serializable(this.prisma, async (tx) => {
      const row = await tx.stamp.create({
        data: {
          genreId: input.genreId,
          name: input.name,
          description: input.description ?? '',
        },
      });
      const genre = await tx.genre.findUniqueOrThrow({
        where: { id: row.genreId },
      });
      await notifyMembers(
        tx,
        userId,
        genre.tripId,
        'スタンプが作成されました',
        row.name,
        { type: 'stamp', stampId: row.id },
      );
      return this.toDomain({ ...row, posts: [], _count: { posts: 0 } }, false);
    });
  }

  async findById(id: string, userId: string): Promise<Stamp | null> {
    const row = await this.prisma.stamp.findUnique({
      where: { id },
      include: completion,
    });
    const unread = await this.unreadIds([id], userId);
    return row ? this.toDomain(row, unread.has(id)) : null;
  }

  async findAll(query: ListStampsDto, userId: string) {
    const rows = await this.prisma.stamp.findMany({
      where: { genreId: query.genreId, ...paginationWhere(query, 'asc') },
      include: completion,
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    const unread = await this.unreadIds(
      rows.map((row) => row.id),
      userId,
    );
    return paginate(
      rows.map((row) => this.toDomain(row, unread.has(row.id))),
      query.limit,
    );
  }

  async update(
    id: string,
    input: UpdateStampDto,
    userId: string,
  ): Promise<Stamp> {
    return serializable(this.prisma, async (tx) => {
      const current = await tx.stamp.findUniqueOrThrow({
        where: { id },
        include: completion,
      });
      const changed =
        (input.name !== undefined && input.name !== current.name) ||
        (input.description !== undefined &&
          input.description !== current.description);
      const row = changed
        ? await tx.stamp.update({
            where: { id },
            data: { name: input.name, description: input.description },
            include: completion,
          })
        : current;
      if (changed) {
        const genre = await tx.genre.findUniqueOrThrow({
          where: { id: row.genreId },
        });
        await notifyMembers(
          tx,
          userId,
          genre.tripId,
          'スタンプが更新されました',
          row.name,
          { type: 'stamp', stampId: id },
        );
      }
      const unread = await this.unreadIds([id], userId, tx);
      return this.toDomain(row, unread.has(id));
    });
  }

  private async unreadIds(
    ids: string[],
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!ids.length) return new Set<string>();
    const rows = await tx.stamp.findMany({
      where: {
        id: { in: ids },
        posts: {
          some: {
            mediaType: 'IMAGE',
            authorId: { not: userId },
            reads: { none: { userId } },
          },
        },
      },
      select: { id: true },
    });
    return new Set(rows.map((row) => row.id));
  }

  private toDomain(
    row: PrismaStamp & { posts: { id: string }[]; _count: { posts: number } },
    unread: boolean,
  ): Stamp {
    return new Stamp(
      row.id,
      row.genreId,
      row.name,
      row.description,
      row.createdAt,
      row.updatedAt,
      row.posts.length > 0,
      unread,
      row._count.posts,
    );
  }
}
