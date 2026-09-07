import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsUrl,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

/** Unlike IsOptional, null still goes through the field validators. */
export function OptionalField() {
  return ValidateIf((_, value: unknown) => value !== undefined);
}

export function DomainName() {
  return applyDecorators(Transform(trimString), IsString(), Length(1, 100));
}

export function Description() {
  return applyDecorators(IsString(), MaxLength(2000));
}

export function HttpsUrl() {
  return applyDecorators(
    Transform(trimString),
    IsString(),
    MaxLength(2048),
    IsUrl({
      protocols: ['https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_tld: false,
    }),
  );
}
