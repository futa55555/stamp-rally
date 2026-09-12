import type { Prisma } from '../generated/prisma/client.js';

export const activeTrip = { deletedAt: null } satisfies Prisma.TripWhereInput;
export const activeCategory = {
  deletedAt: null,
  trip: activeTrip,
} satisfies Prisma.CategoryWhereInput;
export const activeStamp = {
  deletedAt: null,
  trip: activeTrip,
} satisfies Prisma.StampWhereInput;
export const activePost = {
  deletedAt: null,
  purgedAt: null,
  stamp: activeStamp,
} satisfies Prisma.PostWhereInput;
export const visiblePost = {
  ...activePost,
  status: 'READY',
} satisfies Prisma.PostWhereInput;

export function memberTrip(userId: string) {
  return { ...activeTrip, members: { some: { userId } } };
}
export function memberPost(userId: string) {
  return {
    ...visiblePost,
    stamp: { ...activeStamp, trip: memberTrip(userId) },
  };
}
