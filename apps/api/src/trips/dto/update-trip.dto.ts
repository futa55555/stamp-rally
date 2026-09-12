import { Type } from 'class-transformer';
import { IsObject, ValidateNested, MaxLength } from 'class-validator';
import { SaveTripTemplateDto } from './edit-trip-template.dto.js';
import {
  IsArray,
  IsUUID,
  IsString,
  IsDateString,
  Matches,
  ValidateIf,
} from 'class-validator';
import { DomainName, OptionalField } from '../../common/validation.js';

export class UpdateTripDto {
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  activityPresets?: string[];
  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  customActivities?: string[];
  @OptionalField()
  @IsObject()
  @ValidateNested()
  @Type(() => SaveTripTemplateDto)
  templateEdit?: SaveTripTemplateDto;

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
  @IsUUID()
  coverAssetId?: string | null;
}
