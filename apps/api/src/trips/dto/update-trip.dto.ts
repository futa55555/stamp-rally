import { PartialType } from '@nestjs/mapped-types';
import { CreateTripDto } from './create-trip.dto.js';

export class UpdateTripDto extends PartialType(CreateTripDto) {}
