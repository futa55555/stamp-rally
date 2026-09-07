import { IsUUID } from 'class-validator';
import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class CreateGenreDto {
  @IsUUID()
  tripId!: string;

  @DomainName()
  name!: string;

  @OptionalField()
  @Description()
  description?: string;
}
