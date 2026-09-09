import type { Prisma } from '../generated/prisma/client.js';

export type NotificationTarget =
  | { type: 'trip'; tripId: string }
  | { type: 'genre'; genreId: string }
  | { type: 'stamp'; stampId: string }
  | { type: 'photo' | 'video'; postId: string };

// Must be called in the transaction that changes the target.
export async function notifyMembers(
  tx: Prisma.TransactionClient,
  actorId: string,
  tripId: string,
  title: string,
  body: string,
  target: NotificationTarget,
) {
  const members = await tx.tripMember.findMany({
    where: { tripId, userId: { not: actorId } },
    select: { userId: true },
  });
  if (!members.length) return;
  await tx.notification.createMany({
    data: members.map(({ userId }) => ({
      recipientId: userId,
      tripId,
      title,
      body,
      target,
      postId:
        target.type === 'photo' || target.type === 'video'
          ? target.postId
          : null,
    })),
  });
}
