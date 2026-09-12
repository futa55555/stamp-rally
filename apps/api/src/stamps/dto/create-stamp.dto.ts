import { ArrayMinSize, ArrayUnique, IsArray, IsUUID } from 'class-validator';
import {
  Description,
  DomainName,
  OptionalField,
} from '../../common/validation.js';

export class CreateStampDto {
  @IsUUID()
  tripId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  categoryIds!: string[];

  @DomainName()
  name!: string;

  @OptionalField()
  @Description()
  description?: string;
}
