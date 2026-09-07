import { Transform } from 'class-transformer';
import { IsString, IsUUID, Length } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  stampId: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 2000)
  text: string;
}
