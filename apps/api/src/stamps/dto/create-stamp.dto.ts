import { IsUUID } from 'class-validator';
import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class CreateStampDto {
  @IsUUID()
  genreId!: string;

  @DomainName()
  name!: string;

  @OptionalField()
  @Description()
  description?: string;
}
