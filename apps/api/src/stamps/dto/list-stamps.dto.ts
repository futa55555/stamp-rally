import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class ListStampsDto extends PaginationQueryDto {
  @IsUUID()
  genreId!: string;
}
