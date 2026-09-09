import { BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateUploadBatchDto, type UploadFileDto } from './dto/uploads.dto.js';
import { validateUploadFiles } from './upload-policy.js';

const image = (index = 0): UploadFileDto => ({
  clientId: `image-${index}`,
  fileName: '写真.heic',
  mimeType: 'image/heic',
  mediaType: 'IMAGE',
  byteSize: 50_000_000,
});
const video = (index = 0): UploadFileDto => ({
  clientId: `video-${index}`,
  fileName: '動画.mov',
  mimeType: 'video/quicktime',
  mediaType: 'VIDEO',
  byteSize: 1_000_000_000,
  durationMs: 300_000,
});

describe('Upload policy', () => {
  it('accepts 30 files with five maximum-size, maximum-duration videos', () => {
    expect(() =>
      validateUploadFiles([
        ...Array.from({ length: 25 }, (_, i) => image(i)),
        ...Array.from({ length: 5 }, (_, i) => video(i)),
      ]),
    ).not.toThrow();
  });
  it.each(
    [
      Array.from({ length: 31 }, (_, i) => image(i)),
      Array.from({ length: 6 }, (_, i) => video(i)),
      [{ ...image(), byteSize: 50_000_001 }],
      [{ ...video(), byteSize: 1_000_000_001 }],
      [{ ...video(), durationMs: 300_001 }],
      [{ ...image(), byteSize: 0 }],
      [{ ...image(), mimeType: 'image/gif' }],
      [image(), image()],
    ].map((files) => ({ files })),
  )('rejects files beyond the upload policy', ({ files }) => {
    expect(() => validateUploadFiles(files as UploadFileDto[])).toThrow(
      BadRequestException,
    );
  });
  it('validates nested file entries rather than accepting forged sizes or empty client IDs', async () => {
    const dto = plainToInstance(CreateUploadBatchDto, {
      stampId: '00000000-0000-4000-8000-000000000001',
      files: [{ ...image(), byteSize: '50000000' }],
    });
    expect(await validate(dto)).not.toHaveLength(0);
    expect(() => validateUploadFiles([{ ...image(), clientId: ' ' }])).toThrow(
      BadRequestException,
    );
  });
});
