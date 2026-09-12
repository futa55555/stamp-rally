import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsUUID,
  IsDateString,
  IsObject,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { DomainName, OptionalField } from '../../common/validation.js';

const trimItems = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class SelectedStampDto {
  @OptionalField() @IsString() @MaxLength(100) key?: string;
  @DomainName()
  title!: string;
}

export class SelectedCategoryDto {
  @OptionalField() @IsString() @MaxLength(100) key?: string;
  @DomainName()
  name!: string;

  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SelectedStampDto)
  stamps!: SelectedStampDto[];
}

export class CreateTripDto {
  @OptionalField()
  @IsUUID()
  clientRequestId?: string;

  @OptionalField()
  @IsArray()
  @IsString({ each: true })
  locations?: string[];

  @OptionalField()
  @Transform(trimItems)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  activityPresets?: string[];

  @OptionalField()
  @Transform(trimItems)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  customActivities?: string[];

  @OptionalField()
  @IsArray()
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => SelectedCategoryDto)
  selectedCategories?: SelectedCategoryDto[];

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
