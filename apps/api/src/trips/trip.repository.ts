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
import type { TripTemplatePreview } from '../trip-templates/types.js';

interface TripProgress {
  id: string;
  totalCategoryCount: number;
  completedCategoryCount: number;
}

@Injectable()
export class TripRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    input: TripInput,
    tx: Prisma.TransactionClient,
    categories: TripTemplatePreview['categories'] = [],
    templateExclusions: string[] = [],
  ): Promise<Trip> {
    const row = await tx.trip.create({
      data: {
        clientRequestId: input.clientRequestId,
        templateExclusions,
        locations: input.locations ?? [],
        activityPresets: input.activityPresets ?? [],
        customActivities: input.customActivities ?? [],
        name: input.name,
        startDate: calendarDate(input.startDate),
        endDate: calendarDate(input.endDate),
        coverImageUrl: input.coverAssetId
          ? null
          : (input.coverImageUrl ?? null),
        coverAssetId: input.coverAssetId ?? null,
        createdById: userId,
        members: { create: { userId } },
      },
    });
    const stamps = new Map<
      string,
      {
        name: string;
        key?: string;
        memberships: {
          categoryId: string;
          manual: boolean;
          templateSources: string[];
        }[];
      }
    >();
    for (const category of categories.filter(
      (category) => category.stamps.length,
    )) {
      const created = await tx.category.create({
        data: {
          tripId: row.id,
          name: category.name,
          templateKey: category.key,
        },
      });
      for (const item of category.stamps) {
        const identity = item.key ?? item.title;
        const stamp = stamps.get(identity) ?? {
          name: item.title,
          key: item.key,
          memberships: [],
        };
        stamp.memberships.push({
          categoryId: created.id,
          manual: !item.key,
          templateSources: (item.sources ?? []).flatMap((source) =>
            source.key ? [`${source.type}:${source.key}`] : [],
          ),
        });
        stamps.set(identity, stamp);
      }
    }
    for (const stamp of stamps.values())
      await tx.stamp.create({
        data: {
          tripId: row.id,
          name: stamp.name,
          templateKey: stamp.key,
          categories: { create: stamp.memberships },
        },
      });
    const progress = await this.progress([row.id], tx);
    return this.toDomain(row, progress.get(row.id));
  }

  async findByRequestId(
    userId: string,
    clientRequestId: string,
    tx: Prisma.TransactionClient,
  ) {
    const row = await tx.trip.findUnique({
      where: {
        createdById_clientRequestId: { createdById: userId, clientRequestId },
      },
    });
    if (!row) return null;
    const progress = await this.progress([row.id], tx);
    return this.toDomain(row, progress.get(row.id));
  }

  async findById(
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<Trip | null> {
    const row = await tx.trip.findUnique({ where: { id, deletedAt: null } });
    if (!row) return null;
    const progress = await this.progress([id], tx);
    return this.toDomain(row, progress.get(id));
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const rows = await this.prisma.trip.findMany({
      where: {
        deletedAt: null,
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
      where: { id: trip.id, deletedAt: null },
      data: {
        locations: trip.locations,
        name: trip.name,
        startDate: calendarDate(trip.startDate),
        endDate: calendarDate(trip.endDate),
        coverImageUrl: trip.coverAssetId ? null : trip.coverImageUrl,
        coverAssetId: trip.coverAssetId,
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
      SELECT t.id, COUNT(g.id)::int AS "totalCategoryCount",
        COUNT(g.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM stamp_categories s JOIN stamps st ON st.id = s.stamp_id AND st.deleted_at IS NULL WHERE s.category_id = g.id)
            AND NOT EXISTS (
              SELECT 1 FROM stamp_categories s JOIN stamps st ON st.id = s.stamp_id AND st.deleted_at IS NULL WHERE s.category_id = g.id
                AND NOT EXISTS (SELECT 1 FROM posts p WHERE p.stamp_id = s.stamp_id AND p.status = 'READY' AND p.deleted_at IS NULL AND p.purged_at IS NULL)
            )
        )::int AS "completedCategoryCount"
      FROM trips t
      LEFT JOIN categories g ON g.trip_id = t.id AND g.deleted_at IS NULL
      WHERE t.deleted_at IS NULL AND t.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
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
      progress?.totalCategoryCount ?? 0,
      progress?.completedCategoryCount ?? 0,
      row.locations,
      row.coverAssetId,
      row.activityPresets,
      row.customActivities,
    );
  }
}
