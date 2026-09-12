import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class ListCategoriesDto extends PaginationQueryDto {
  @IsUUID()
  tripId!: string;
}
