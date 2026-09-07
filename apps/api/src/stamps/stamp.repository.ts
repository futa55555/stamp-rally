import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import { type Stamp as PrismaStamp } from '../generated/prisma/client.js';
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { ListStampsDto } from './dto/list-stamps.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';
import { Stamp } from './entities/stamp.entity.js';

const completion = { posts: { take: 1, select: { id: true } } } as const;

@Injectable()
export class StampRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateStampDto): Promise<Stamp> {
    const row = await this.prisma.stamp.create({
      data: {
        genreId: input.genreId,
        name: input.name,
        description: input.description ?? '',
      },
    });
    return this.toDomain({ ...row, posts: [] });
  }

  async findById(id: string): Promise<Stamp | null> {
    const row = await this.prisma.stamp.findUnique({
      where: { id },
      include: completion,
    });
    return row ? this.toDomain(row) : null;
  }

  async findAll(query: ListStampsDto) {
    const rows = await this.prisma.stamp.findMany({
      where: { genreId: query.genreId, ...paginationWhere(query, 'asc') },
      include: completion,
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    return paginate(
      rows.map((row) => this.toDomain(row)),
      query.limit,
    );
  }

  async update(id: string, input: UpdateStampDto): Promise<Stamp> {
    const row = await this.prisma.stamp.update({
      where: { id },
      data: { name: input.name, description: input.description },
      include: completion,
    });
    return this.toDomain(row);
  }

  private toDomain(row: PrismaStamp & { posts: { id: string }[] }): Stamp {
    return new Stamp(
      row.id,
      row.genreId,
      row.name,
      row.description,
      row.createdAt,
      row.updatedAt,
      row.posts.length > 0,
    );
  }
}
