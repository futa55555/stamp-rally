import { PartialType } from '@nestjs/mapped-types';
import { CreateStampDto } from './create-stamp.dto.js';

export class UpdateStampDto extends PartialType(CreateStampDto) {}
