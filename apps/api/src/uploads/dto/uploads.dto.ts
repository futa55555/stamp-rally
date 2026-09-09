import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { MediaType } from '../../generated/prisma/enums.js';

export class UploadFileDto {
  @IsString() @MaxLength(128) clientId: string;
  @IsString() @MaxLength(255) fileName: string;
  @IsString() @MaxLength(127) mimeType: string;
  @IsEnum(MediaType) mediaType: MediaType;
  @IsInt() @Min(1) @Max(1_000_000_000) byteSize: number;
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(300_000)
  durationMs?: number;
}

export class CreateUploadBatchDto {
  @IsUUID() stampId: string;
  @IsOptional() @IsUUID() clientRequestId?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique((file: UploadFileDto) => file.clientId)
  @ValidateNested({ each: true })
  @Type(() => UploadFileDto)
  files: UploadFileDto[];
}

export class SignUploadPartsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(64, { each: true })
  partNumbers: number[];
}

export class CompletedPartDto {
  @IsInt() @Min(1) @Max(64) partNumber: number;
  @IsString() @MaxLength(128) etag: string;
}

export class CompleteUploadDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(64)
  @ArrayUnique((part: CompletedPartDto) => part.partNumber)
  @ValidateNested({ each: true })
  @Type(() => CompletedPartDto)
  parts?: CompletedPartDto[];
}
