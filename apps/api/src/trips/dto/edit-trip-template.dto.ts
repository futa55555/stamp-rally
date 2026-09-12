import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsObject,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { OptionalField } from '../../common/validation.js';
import { PreviewTripTemplateDto } from '../../trip-templates/dto/preview-trip-template.dto.js';

export class TemplateChangeDto {
  @IsString() @MaxLength(150) categoryRef!: string;
  @OptionalField() @IsString() @MaxLength(150) stampRef?: string;
  @IsBoolean() selected!: boolean;
}
export class EditTripTemplateDto extends PreviewTripTemplateDto {
  @OptionalField()
  @IsArray()
  @ArrayMaxSize(1000)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => TemplateChangeDto)
  changes?: TemplateChangeDto[];
}
export class SaveTripTemplateDto {
  @IsUUID() clientRequestId!: string;
  @OptionalField() @IsString() @MaxLength(64) confirmationToken?: string;
  @IsArray()
  @ArrayMaxSize(1000)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => TemplateChangeDto)
  changes!: TemplateChangeDto[];
}
