import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class UpdateStampDto {
  @OptionalField()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  genreIds?: string[];

  @OptionalField()
  @DomainName()
  name?: string;

  @OptionalField()
  @Description()
  description?: string;
}
