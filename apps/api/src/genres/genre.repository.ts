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
  type Genre as PrismaGenre,
} from '../generated/prisma/client.js';
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { ListGenresDto } from './dto/list-genres.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { Genre } from './entities/genre.entity.js';

interface GenreProgress {
  id: string;
  totalStampCount: number;
  completedStampCount: number;
  hasUnreadPhotos: boolean;
  hasUnreadMedia: boolean;
}

@Injectable()
export class GenreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGenreDto, userId: string): Promise<Genre> {
    return serializable(this.prisma, async (tx) => {
      const row = await tx.genre.create({
        data: {
          tripId: input.tripId,
          name: input.name,
          description: input.description ?? '',
        },
      });
      await notifyMembers(
        tx,
        userId,
        row.tripId,
        'ジャンルが作成されました',
        row.name,
        { type: 'genre', genreId: row.id },
      );
      return this.toDomain(row);
    });
  }

  async findById(id: string, userId: string): Promise<Genre | null> {
    const row = await this.prisma.genre.findUnique({ where: { id } });
    if (!row) return null;
    const progress = await this.progress([id], userId);
    return this.toDomain(row, progress.get(id));
  }

  async findAll(query: ListGenresDto, userId: string) {
    const rows = await this.prisma.genre.findMany({
      where: { tripId: query.tripId, ...paginationWhere(query, 'asc') },
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    const progress = await this.progress(
      rows.map((row) => row.id),
      userId,
    );
    return paginate(
      rows.map((row) => this.toDomain(row, progress.get(row.id))),
      query.limit,
    );
  }

  async update(
    id: string,
    input: UpdateGenreDto,
    userId: string,
  ): Promise<Genre> {
    return serializable(this.prisma, async (tx) => {
      const current = await tx.genre.findUniqueOrThrow({ where: { id } });
      const changed =
        (input.name !== undefined && input.name !== current.name) ||
        (input.description !== undefined &&
          input.description !== current.description);
      const row = changed
        ? await tx.genre.update({
            where: { id },
            data: { name: input.name, description: input.description },
          })
        : current;
      if (changed)
        await notifyMembers(
          tx,
          userId,
          row.tripId,
          'ジャンルが更新されました',
          row.name,
          { type: 'genre', genreId: id },
        );
      const progress = await this.progress([id], userId, tx);
      return this.toDomain(row, progress.get(id));
    });
  }

  private async progress(
    ids: string[],
    userId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (ids.length === 0) return new Map<string, GenreProgress>();
    const rows = await tx.$queryRaw<GenreProgress[]>(Prisma.sql`
      SELECT g.id, COUNT(s.id)::int AS "totalStampCount",
        COUNT(s.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM posts p WHERE p.stamp_id = s.id AND p.status = 'READY')
        )::int AS "completedStampCount",
        EXISTS (
          SELECT 1 FROM stamp_genres us JOIN posts p ON p.stamp_id = us.stamp_id
          WHERE us.genre_id = g.id AND p.status = 'READY' AND p.author_id <> ${userId}::uuid
          AND NOT EXISTS (SELECT 1 FROM photo_reads r WHERE r.post_id = p.id AND r.user_id = ${userId}::uuid)
        ) AS "hasUnreadMedia",
        EXISTS (
          SELECT 1 FROM stamp_genres us JOIN posts p ON p.stamp_id = us.stamp_id
          WHERE us.genre_id = g.id AND p.status = 'READY' AND p.media_type = 'IMAGE' AND p.author_id <> ${userId}::uuid
          AND NOT EXISTS (SELECT 1 FROM photo_reads r WHERE r.post_id = p.id AND r.user_id = ${userId}::uuid)
        ) AS "hasUnreadPhotos"
      FROM genres g LEFT JOIN stamp_genres sg ON sg.genre_id = g.id
      LEFT JOIN stamps s ON s.id = sg.stamp_id
      WHERE g.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY g.id
    `);
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toDomain(row: PrismaGenre, progress?: GenreProgress): Genre {
    return new Genre(
      row.id,
      row.tripId,
      row.name,
      row.description,
      row.createdAt,
      row.updatedAt,
      progress?.totalStampCount ?? 0,
      progress?.completedStampCount ?? 0,
      progress?.hasUnreadPhotos ?? false,
      progress?.hasUnreadMedia ?? false,
    );
  }
}
