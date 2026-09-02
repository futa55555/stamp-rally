import { PartialType } from '@nestjs/mapped-types';
import { CreateTeamDto } from './create-team.dto.js';

export class UpdateTeamDto extends PartialType(CreateTeamDto) {}
