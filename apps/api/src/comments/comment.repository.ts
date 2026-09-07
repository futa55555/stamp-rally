import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
} from '../common/pagination.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { ListCommentsDto } from './dto/list-comments.dto.js';
import { Comment } from './entities/comment.entity.js';

const commentInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentInclude;

type CommentRecord = Prisma.CommentGetPayload<{
  include: typeof commentInclude;
}>;

@Injectable()
export class CommentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    stampId: string;
    authorId: string;
    text: string;
  }): Promise<Comment> {
    const row = await this.prisma.comment.create({
      data,
      include: commentInclude,
    });
    return this.toDomain(row);
  }

  async list(query: ListCommentsDto) {
    const rows = await this.prisma.comment.findMany({
      where: { stampId: query.stampId, ...paginationWhere(query, 'asc') },
      include: commentInclude,
      orderBy: paginationOrder('asc'),
      take: query.limit + 1,
    });
    return paginate(
      rows.map((row) => this.toDomain(row)),
      query.limit,
    );
  }

  private toDomain(row: CommentRecord): Comment {
    return new Comment(
      row.id,
      row.stampId,
      row.author,
      row.text,
      row.createdAt,
      row.updatedAt,
    );
  }
}
