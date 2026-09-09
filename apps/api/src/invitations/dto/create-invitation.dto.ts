import { IsIn, IsInt, Matches, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/pagination.js';

export class InvitationTokenDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  token!: string;
}
export class InvitationDecisionDto {
  @IsInt()
  @Min(1)
  generation!: number;
}
export class InvitationQueryDto extends PaginationQueryDto {
  @IsIn(['mine', 'review'])
  view: 'mine' | 'review' = 'mine';
}
