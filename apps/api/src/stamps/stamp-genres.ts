import { BadRequestException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';

// Match the genre list's stable ordering in every stamp/post response.
export const genreMemberships = {
  select: { genreId: true },
  orderBy: [{ genre: { createdAt: 'asc' } }, { genre: { id: 'asc' } }],
} as const satisfies Prisma.Stamp$genresArgs;

export async function requireStampGenres(
  tx: Prisma.TransactionClient,
  tripId: string,
  genreIds: string[],
) {
  if (
    !genreIds.length ||
    new Set(genreIds).size !== genreIds.length ||
    (await tx.genre.count({ where: { id: { in: genreIds }, tripId } })) !==
      genreIds.length
  ) {
    throw new BadRequestException(
      'Select one or more distinct genres from this trip',
    );
  }
}
