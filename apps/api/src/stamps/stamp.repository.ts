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
import { genreMemberships, requireStampGenres } from './stamp-genres.js';

const completion = {
  genres: genreMemberships,
  posts: { where: { status: 'READY' as const }, take: 1, select: { id: true } },
} as const;

interface StampMediaStats {
  id: string;
  photoCount: number;
  videoCount: number;
  hasUnreadPhotos: boolean;
  hasUnreadMedia: boolean;
}

@Injectable()
export class StampRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStampDto, userId: string): Promise<Stamp> {
    return serializable(this.prisma, async (tx) => {
      await requireStampGenres(tx, input.tripId, input.genreIds);
      const row = await tx.stamp.create({
        data: {
          tripId: input.tripId,
          genres: { create: input.genreIds.map((genreId) => ({ genreId })) },
          name: input.name,
          description: input.description ?? '',
        },
        include: completion,
      });
      await notifyMembers(
        tx,
        userId,
        row.tripId,
        'スタンプが作成されました',
        row.name,
        { type: 'stamp', stampId: row.id },
      );
      return this.toDomain(row);
    });
  }

  async findById(id: string, userId: string): Promise<Stamp | null> {
    const row = await this.prisma.stamp.findUnique({
      where: { id },
      include: completion,
    });
    const unread = await this.mediaStats([id], userId);
    return row ? this.toDomain(row, unread.get(id)) : null;
  }

  async findAll(query: ListStampsDto, userId: string) {
    const rows = await this.prisma.stamp.findMany({
      where: {
        genres: { some: { genreId: query.genreId } },
        ...paginationWhere(query, 'asc'),
      },
      include: completion,
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    const unread = await this.mediaStats(
      rows.map((row) => row.id),
      userId,
    );
    return paginate(
      rows.map((row) => this.toDomain(row, unread.get(row.id))),
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
      if (input.genreIds)
        await requireStampGenres(tx, current.tripId, input.genreIds);
      const membershipChanged =
        input.genreIds !== undefined &&
        (input.genreIds.length !== current.genres.length ||
          current.genres.some(
            ({ genreId }) => !input.genreIds!.includes(genreId),
          ));
      const changed =
        membershipChanged ||
        (input.name !== undefined && input.name !== current.name) ||
        (input.description !== undefined &&
          input.description !== current.description);
      const row = changed
        ? await tx.stamp.update({
            where: { id },
            data: {
              name: input.name,
              description: input.description,
              ...(membershipChanged
                ? {
                    genres: {
                      deleteMany: {},
                      create: input.genreIds!.map((genreId) => ({ genreId })),
                    },
                  }
                : {}),
            },
            include: completion,
          })
        : current;
      if (changed) {
        await notifyMembers(
          tx,
          userId,
          row.tripId,
          'スタンプが更新されました',
          row.name,
          { type: 'stamp', stampId: id },
        );
      }
      const unread = await this.mediaStats([id], userId, tx);
      return this.toDomain(row, unread.get(id));
    });
  }

  private async mediaStats(
    ids: string[],
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!ids.length) return new Map<string, StampMediaStats>();
    const rows = await tx.$queryRaw<StampMediaStats[]>(Prisma.sql`
      SELECT p.stamp_id AS id,
        COUNT(*) FILTER (WHERE p.media_type = 'IMAGE')::int AS "photoCount",
        COUNT(*) FILTER (WHERE p.media_type = 'VIDEO')::int AS "videoCount",
        BOOL_OR(p.media_type = 'IMAGE' AND p.author_id <> ${userId}::uuid AND r.post_id IS NULL) AS "hasUnreadPhotos",
        BOOL_OR(p.author_id <> ${userId}::uuid AND r.post_id IS NULL) AS "hasUnreadMedia"
      FROM posts p
      LEFT JOIN photo_reads r ON r.post_id = p.id AND r.user_id = ${userId}::uuid
      WHERE p.status = 'READY' AND p.stamp_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY p.stamp_id
    `);
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toDomain(
    row: PrismaStamp & {
      posts: { id: string }[];
      genres: { genreId: string }[];
    },
    stats?: StampMediaStats,
  ): Stamp {
    return new Stamp(
      row.id,
      row.tripId,
      row.genres.map(({ genreId }) => genreId),
      row.name,
      row.description,
      row.createdAt,
      row.updatedAt,
      row.posts.length > 0,
      stats?.hasUnreadPhotos ?? false,
      stats?.photoCount ?? 0,
      stats?.videoCount ?? 0,
      (stats?.photoCount ?? 0) + (stats?.videoCount ?? 0),
      stats?.hasUnreadMedia ?? false,
    );
  }
}
