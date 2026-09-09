import { BadRequestException } from '@nestjs/common';
import type { UploadFileDto } from './dto/uploads.dto.js';

export const IMAGE_MAX_BYTES = 50_000_000;
export const VIDEO_MAX_BYTES = 1_000_000_000;
export const VIDEO_MAX_SECONDS = 300;
export const MULTIPART_PART_SIZE = 16 * 1024 * 1024;
export const UPLOAD_LIFETIME_MS = 24 * 60 * 60 * 1000;

const imageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/avif',
]);
const videoMimeTypes = new Set(['video/mp4', 'video/quicktime']);

export function validateUploadFiles(files: UploadFileDto[]) {
  if (!files.length || files.length > 30)
    throw new BadRequestException('Choose between 1 and 30 files');
  if (files.filter((file) => file.mediaType === 'VIDEO').length > 5)
    throw new BadRequestException('A batch may contain at most 5 videos');
  if (new Set(files.map((file) => file.clientId)).size !== files.length)
    throw new BadRequestException('clientId must be unique within the batch');
  for (const file of files) {
    if (
      !file.clientId.trim() ||
      !file.fileName.trim() ||
      [...file.fileName].some((char) =>
        [0, 10, 13].includes(char.charCodeAt(0)),
      )
    )
      throw new BadRequestException(
        'A file needs a clientId and a valid fileName',
      );
    const types = file.mediaType === 'IMAGE' ? imageMimeTypes : videoMimeTypes;
    if (!types.has(file.mimeType))
      throw new BadRequestException('Unsupported image or video format');
    const limit =
      file.mediaType === 'IMAGE' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
    if (
      !Number.isSafeInteger(file.byteSize) ||
      file.byteSize < 1 ||
      file.byteSize > limit
    )
      throw new BadRequestException(
        `File size must be between 1 and ${limit} bytes`,
      );
    if (
      file.mediaType === 'VIDEO' &&
      file.durationMs !== undefined &&
      file.durationMs > 300_000
    )
      throw new BadRequestException('Videos must be 5 minutes or shorter');
  }
}
