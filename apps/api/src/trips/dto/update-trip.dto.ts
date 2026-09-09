import {
  IsArray,
  IsString,
  IsDateString,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  DomainName,
  HttpsUrl,
  OptionalField,
} from '../../common/validation.js';

export class UpdateTripDto {
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @OptionalField()
  @DomainName()
  name?: string;

  @OptionalField()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @OptionalField()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @ValidateIf((_, value) => value !== undefined && value !== null)
  @HttpsUrl()
  coverImageUrl?: string | null;
}
