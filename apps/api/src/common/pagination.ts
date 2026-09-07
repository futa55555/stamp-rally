import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsInt, IsString, Max, MaxLength, Min, isUUID } from 'class-validator';
import { OptionalField } from './validation.js';

export class PaginationQueryDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value,
  )
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @OptionalField()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}

type Direction = 'asc' | 'desc';

export function paginationOrder(direction: Direction) {
  return [{ createdAt: direction }, { id: direction }];
}

export function paginationWhere(
  query: PaginationQueryDto,
  direction: Direction,
) {
  if (query.cursor === undefined) return {};
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(query.cursor))
      throw new Error('Invalid encoding');
    const value: unknown = JSON.parse(
      Buffer.from(query.cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof value !== 'object' ||
      value === null ||
      !('id' in value) ||
      !('createdAt' in value) ||
      typeof value.id !== 'string' ||
      !isUUID(value.id) ||
      typeof value.createdAt !== 'string'
    )
      throw new Error('Invalid cursor');
    const createdAt = new Date(value.createdAt);
    if (
      !Number.isFinite(createdAt.getTime()) ||
      createdAt.toISOString() !== value.createdAt
    )
      throw new Error('Invalid date');
    return direction === 'asc'
      ? {
          OR: [
            { createdAt: { gt: createdAt } },
            { createdAt, id: { gt: value.id } },
          ],
        }
      : {
          OR: [
            { createdAt: { lt: createdAt } },
            { createdAt, id: { lt: value.id } },
          ],
        };
  } catch {
    throw new BadRequestException('Invalid cursor');
  }
}

export function paginate<T extends { id: string; createdAt: Date }>(
  rows: T[],
  limit: number,
) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? Buffer.from(
          JSON.stringify({
            id: last.id,
            createdAt: last.createdAt.toISOString(),
          }),
        ).toString('base64url')
      : null;
  return { items, nextCursor };
}
