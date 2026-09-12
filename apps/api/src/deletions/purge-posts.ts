import type { Prisma } from '../generated/prisma/client.js';

export const MEDIA_DELETE_GRACE_MS = 20 * 60_000;

/** Call inside a serializable transaction: retained records and cleanup commit together. */
export async function purgePosts(
  tx: Prisma.TransactionClient,
  scope: Prisma.PostWhereInput,
  now = new Date(),
) {
  const posts = await tx.post.findMany({
    where: { AND: [scope, { purgedAt: null }] },
  });
  if (!posts.length) return;
  const where = { id: { in: posts.map((post) => post.id) }, purgedAt: null };
  await tx.post.updateMany({
    where: { ...where, deletedAt: null },
    data: { deletedAt: now },
  });
  await tx.post.updateMany({
    where,
    data: {
      purgedAt: now,
      processingVersion: { increment: 1 },
      processingStartedAt: null,
    },
  });
  await tx.mediaCleanup.createMany({
    data: posts.map((post) => ({
      keys: [
        post.originalKey,
        post.largeKey,
        post.smallKey,
        post.playbackKey,
        post.stagingKey,
      ].filter((key): key is string => !!key),
      multipartKey: post.stagingKey,
      multipartUploadId: post.multipartUploadId,
      createdAt: new Date(now.getTime() + MEDIA_DELETE_GRACE_MS),
    })),
  });
}
