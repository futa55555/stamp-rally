import { IsEnum, IsUUID } from 'class-validator';
import { HttpsUrl } from '../../common/validation.js';
import { MediaType } from '../../generated/prisma/enums.js';

export class CreatePostDto {
  @IsUUID()
  stampId: string;

  @IsEnum(MediaType)
  mediaType: MediaType;

  @HttpsUrl()
  mediaUrl: string;
}
