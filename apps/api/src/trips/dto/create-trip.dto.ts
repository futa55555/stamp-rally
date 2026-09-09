import {
  IsArray,
  IsUUID,
  IsDateString,
  IsString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { DomainName, OptionalField } from '../../common/validation.js';

export class CreateTripDto {
  @OptionalField()
  @IsUUID()
  clientRequestId?: string;

  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @DomainName()
  name!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate!: string;

  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate!: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @IsUUID()
  coverAssetId?: string | null;
}
