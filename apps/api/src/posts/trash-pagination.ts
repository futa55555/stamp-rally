import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Prisma } from '../generated/prisma/client.js';

type Cursor = {
  tripCreatedAt: string;
  tripId: string;
  deletedAt: string;
  id: string;
};
type Row = {
  id: string;
  deletedAt: Date | null;
  stamp: { trip: { id: string; createdAt: Date } };
};
export const trashOrder = [
  { stamp: { trip: { createdAt: 'desc' } } },
  { stamp: { tripId: 'desc' } },
  { deletedAt: 'desc' },
  { id: 'desc' },
] satisfies Prisma.PostOrderByWithRelationInput[];

export function trashCursor(row: Row): string {
  const value: Cursor = {
    tripCreatedAt: row.stamp.trip.createdAt.toISOString(),
    tripId: row.stamp.trip.id,
    deletedAt: row.deletedAt!.toISOString(),
    id: row.id,
  };
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}
export function trashAfter(cursor?: string): Prisma.PostWhereInput {
  if (!cursor) return {};
  try {
    if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error();
    const value: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString(),
    );
    if (!value || typeof value !== 'object') throw new Error();
    const c = value as Cursor;
    for (const id of [c.tripId, c.id])
      if (typeof id !== 'string' || !isUUID(id)) throw new Error();
    for (const date of [c.tripCreatedAt, c.deletedAt])
      if (typeof date !== 'string' || new Date(date).toISOString() !== date)
        throw new Error();
    const tripDate = new Date(c.tripCreatedAt),
      deletedAt = new Date(c.deletedAt);
    const sameTrip = { tripId: c.tripId, trip: { createdAt: tripDate } };
    return {
      OR: [
        { stamp: { trip: { createdAt: { lt: tripDate } } } },
        { stamp: { tripId: { lt: c.tripId }, trip: { createdAt: tripDate } } },
        { stamp: sameTrip, deletedAt: { lt: deletedAt } },
        { stamp: sameTrip, deletedAt, id: { lt: c.id } },
      ],
    };
  } catch {
    throw new BadRequestException('Invalid trash cursor');
  }
}
