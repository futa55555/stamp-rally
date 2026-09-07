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
}

@Injectable()
export class GenreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateGenreDto): Promise<Genre> {
    const row = await this.prisma.genre.create({
      data: {
        tripId: input.tripId,
        name: input.name,
        description: input.description ?? '',
      },
    });
    return this.toDomain(row);
  }

  async findById(id: string): Promise<Genre | null> {
    const row = await this.prisma.genre.findUnique({ where: { id } });
    if (!row) return null;
    const progress = await this.progress([id]);
    return this.toDomain(row, progress.get(id));
  }

  async findAll(query: ListGenresDto) {
    const rows = await this.prisma.genre.findMany({
      where: { tripId: query.tripId, ...paginationWhere(query, 'asc') },
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    const progress = await this.progress(rows.map((row) => row.id));
    return paginate(
      rows.map((row) => this.toDomain(row, progress.get(row.id))),
      query.limit,
    );
  }

  async update(id: string, input: UpdateGenreDto): Promise<Genre> {
    const row = await this.prisma.genre.update({
      where: { id },
      data: { name: input.name, description: input.description },
    });
    const progress = await this.progress([id]);
    return this.toDomain(row, progress.get(id));
  }

  private async progress(ids: string[]) {
    if (ids.length === 0) return new Map<string, GenreProgress>();
    const rows = await this.prisma.$queryRaw<GenreProgress[]>(Prisma.sql`
      SELECT g.id, COUNT(s.id)::int AS "totalStampCount",
        COUNT(s.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM posts p WHERE p.stamp_id = s.id)
        )::int AS "completedStampCount"
      FROM genres g
      LEFT JOIN stamps s ON s.genre_id = g.id
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
    );
  }
}
