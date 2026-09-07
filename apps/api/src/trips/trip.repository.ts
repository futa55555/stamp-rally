import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
  type PaginationQueryDto,
} from '../common/pagination.js';
import { Prisma, type Trip as PrismaTrip } from '../generated/prisma/client.js';
import { calendarDate, Trip, type TripInput } from './entities/trip.entity.js';

interface TripProgress {
  id: string;
  totalGenreCount: number;
  completedGenreCount: number;
}

@Injectable()
export class TripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: TripInput,
    tx: Prisma.TransactionClient,
  ): Promise<Trip> {
    const row = await tx.trip.create({
      data: {
        name: input.name,
        startDate: calendarDate(input.startDate),
        endDate: calendarDate(input.endDate),
        coverImageUrl: input.coverImageUrl ?? null,
        createdById: userId,
        members: { create: { userId } },
      },
    });
    return this.toDomain(row);
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Trip | null> {
    const row = await tx.trip.findUnique({ where: { id } });
    if (!row) return null;
    const progress = await this.progress([id], tx);
    return this.toDomain(row, progress.get(id));
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const rows = await this.prisma.trip.findMany({
      where: {
        members: { some: { userId } },
        ...paginationWhere(query, 'desc'),
      },
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    const progress = await this.progress(rows.map((row) => row.id));
    return paginate(
      rows.map((row) => this.toDomain(row, progress.get(row.id))),
      query.limit,
    );
  }

  async save(trip: Trip, tx: Prisma.TransactionClient): Promise<Trip> {
    const row = await tx.trip.update({
      where: { id: trip.id },
      data: {
        name: trip.name,
        startDate: calendarDate(trip.startDate),
        endDate: calendarDate(trip.endDate),
        coverImageUrl: trip.coverImageUrl,
      },
    });
    const progress = await this.progress([row.id], tx);
    return this.toDomain(row, progress.get(row.id));
  }

  async members(tripId: string, query: PaginationQueryDto) {
    const rows = await this.prisma.tripMember.findMany({
      where: { tripId, ...paginationWhere(query, 'asc') },
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
      include: { user: { select: { id: true, name: true } } },
    });
    return paginate(rows, query.limit);
  }

  private async progress(
    ids: string[],
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (ids.length === 0) return new Map<string, TripProgress>();
    const rows = await tx.$queryRaw<TripProgress[]>(Prisma.sql`
      SELECT t.id, COUNT(g.id)::int AS "totalGenreCount",
        COUNT(g.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM stamps s WHERE s.genre_id = g.id)
            AND NOT EXISTS (
              SELECT 1 FROM stamps s WHERE s.genre_id = g.id
                AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.stamp_id = s.id)
            )
        )::int AS "completedGenreCount"
      FROM trips t
      LEFT JOIN genres g ON g.trip_id = t.id
      WHERE t.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY t.id
    `);
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toDomain(row: PrismaTrip, progress?: TripProgress): Trip {
    return new Trip(
      row.id,
      row.name,
      row.startDate.toISOString().slice(0, 10),
      row.endDate.toISOString().slice(0, 10),
      row.coverImageUrl,
      row.createdById,
      row.createdAt,
      row.updatedAt,
      progress?.totalGenreCount ?? 0,
      progress?.completedGenreCount ?? 0,
    );
  }
}
