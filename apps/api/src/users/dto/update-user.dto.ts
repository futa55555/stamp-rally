import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
import { USER_NAME_MAX_LENGTH } from '../entities/user.entity.js';

export class UpdateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, USER_NAME_MAX_LENGTH)
  name!: string;
}
