import type { Prisma } from '../generated/prisma/client.js';
import { memberPost } from '../database/active-records.js';

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60_000;
export const trashExpiresAt = (deletedAt: Date) =>
  new Date(deletedAt.getTime() + TRASH_RETENTION_MS);

export function restorablePosts(
  userId: string,
  now = new Date(),
): Prisma.PostWhereInput {
  return {
    ...memberPost(userId),
    deletedAt: { gt: new Date(now.getTime() - TRASH_RETENTION_MS) },
  };
}
