import { Transform } from 'class-transformer';
import { IsArray, IsString, MaxLength } from 'class-validator';
import { OptionalField } from '../../common/validation.js';

function trimEntries({ value }: { value: unknown }): unknown {
  return Array.isArray(value)
    ? value
        .map((item: unknown) => (typeof item === 'string' ? item.trim() : item))
        .filter((item: unknown) => item !== '')
    : value;
}

export class PreviewTripTemplateDto {
  @OptionalField()
  @Transform(trimEntries)
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @OptionalField()
  @Transform(trimEntries)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  activityPresets?: string[];
}

export class TripTemplateCatalogQueryDto {}
