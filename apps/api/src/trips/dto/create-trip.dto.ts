import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import {
  DomainName,
  HttpsUrl,
  OptionalField,
} from '../../common/validation.js';

export class CreateTripDto {
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
  @HttpsUrl()
  coverImageUrl?: string | null;

  @OptionalField()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((name: unknown) =>
          typeof name === 'string' ? name.trim() : name,
        )
      : value,
  )
  @IsArray()
  @IsString({ each: true })
  @Length(1, 20, { each: true })
  inviteeNames?: string[];
}
