import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';
import { MediaType } from '../../generated/prisma/enums.js';
import { OptionalField } from '../../common/validation.js';

export type PostScope =
  | { type: 'trip'; id: string }
  | { type: 'genre'; id: string }
  | { type: 'stamp'; id: string };

export class ListPostsDto extends PaginationQueryDto {
  @OptionalField()
  @IsEnum(MediaType)
  mediaType?: MediaType;

  @OptionalField()
  @IsUUID()
  tripId?: string;

  @OptionalField()
  @IsUUID()
  genreId?: string;

  @OptionalField()
  @IsUUID()
  stampId?: string;

  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  favoritesOnly?: boolean;
}

export function postScope(query: ListPostsDto): PostScope {
  const scopes: PostScope[] = [];
  if (query.tripId !== undefined)
    scopes.push({ type: 'trip', id: query.tripId });
  if (query.genreId !== undefined)
    scopes.push({ type: 'genre', id: query.genreId });
  if (query.stampId !== undefined)
    scopes.push({ type: 'stamp', id: query.stampId });

  if (scopes.length !== 1) {
    throw new BadRequestException(
      'Specify exactly one of tripId, genreId or stampId',
    );
  }

  return scopes[0];
}
