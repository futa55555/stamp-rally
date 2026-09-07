import { IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class ListCommentsDto extends PaginationQueryDto {
  @IsUUID()
  stampId: string;
}
