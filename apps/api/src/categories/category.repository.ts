import { activeCategory } from '../database/active-records.js';
import { notifyMembers } from '../notifications/notify.js';
import { serializable } from '../database/transaction.js';
import { requireTripMember } from '../trips/trip-access.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import {
  Prisma,
  type Category as PrismaCategory,
} from '../generated/prisma/client.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Category } from './entities/category.entity.js';

interface CategoryProgress {
  id: string;
  totalStampCount: number;
  completedStampCount: number;
  hasUnreadPhotos: boolean;
  hasUnreadMedia: boolean;
}

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCategoryDto, userId: string): Promise<Category> {
    return serializable(this.prisma, async (tx) => {
      await requireTripMember(tx, userId, input.tripId);
      const row = await tx.category.create({
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
        'カテゴリーが作成されました',
        row.name,
        { type: 'category', categoryId: row.id },
      );
      return this.toDomain(row);
    });
  }

  async findById(id: string, userId: string): Promise<Category | null> {
    const row = await this.prisma.category.findUnique({
      where: { id, ...activeCategory },
    });
    if (!row) return null;
    const progress = await this.progress([id], userId);
    return this.toDomain(row, progress.get(id));
  }

  async findAll(query: ListCategoriesDto, userId: string) {
    const rows = await this.prisma.category.findMany({
      where: {
        ...activeCategory,
        tripId: query.tripId,
        ...paginationWhere(query, 'asc'),
      },
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
    input: UpdateCategoryDto,
    userId: string,
  ): Promise<Category> {
    return serializable(this.prisma, async (tx) => {
      const current = await tx.category.findUnique({
        where: { id, ...activeCategory },
      });
      if (!current) throw new NotFoundException('Category not found');
      await requireTripMember(tx, userId, current.tripId);
      const changed =
        (input.name !== undefined && input.name !== current.name) ||
        (input.description !== undefined &&
          input.description !== current.description);
      const row = changed
        ? await tx.category.update({
            where: { id, ...activeCategory },
            data: { name: input.name, description: input.description },
          })
        : current;
      if (changed)
        await notifyMembers(
          tx,
          userId,
          row.tripId,
          'カテゴリーが更新されました',
          row.name,
          { type: 'category', categoryId: id },
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
    if (ids.length === 0) return new Map<string, CategoryProgress>();
    const rows = await tx.$queryRaw<CategoryProgress[]>(Prisma.sql`
      SELECT g.id, COUNT(s.id)::int AS "totalStampCount",
        COUNT(s.id) FILTER (
          WHERE EXISTS (SELECT 1 FROM posts p WHERE p.stamp_id = s.id AND p.status = 'READY' AND p.deleted_at IS NULL AND p.purged_at IS NULL)
        )::int AS "completedStampCount",
        EXISTS (
          SELECT 1 FROM stamp_categories us JOIN stamps ust ON ust.id = us.stamp_id AND ust.deleted_at IS NULL JOIN posts p ON p.stamp_id = us.stamp_id
          WHERE us.category_id = g.id AND p.status = 'READY' AND p.deleted_at IS NULL AND p.purged_at IS NULL AND p.author_id <> ${userId}::uuid
          AND NOT EXISTS (SELECT 1 FROM photo_reads r WHERE r.post_id = p.id AND r.user_id = ${userId}::uuid)
        ) AS "hasUnreadMedia",
        EXISTS (
          SELECT 1 FROM stamp_categories us JOIN stamps ust ON ust.id = us.stamp_id AND ust.deleted_at IS NULL JOIN posts p ON p.stamp_id = us.stamp_id
          WHERE us.category_id = g.id AND p.status = 'READY' AND p.deleted_at IS NULL AND p.purged_at IS NULL AND p.media_type = 'IMAGE' AND p.author_id <> ${userId}::uuid
          AND NOT EXISTS (SELECT 1 FROM photo_reads r WHERE r.post_id = p.id AND r.user_id = ${userId}::uuid)
        ) AS "hasUnreadPhotos"
      FROM categories g LEFT JOIN stamp_categories sg ON sg.category_id = g.id
      LEFT JOIN stamps s ON s.id = sg.stamp_id AND s.deleted_at IS NULL
      WHERE g.deleted_at IS NULL AND g.id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY g.id
    `);
    return new Map(rows.map((row) => [row.id, row]));
  }

  private toDomain(row: PrismaCategory, progress?: CategoryProgress): Category {
    return new Category(
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
