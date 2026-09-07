import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class ListGenresDto extends PaginationQueryDto {
  @IsUUID()
  tripId!: string;
}
