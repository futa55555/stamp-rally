import { ConfigService } from '@nestjs/config';
import { S3Client } from '@aws-sdk/client-s3';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { ObjectStorageService } from './object-storage.service.js';

function configured() {
  return new ObjectStorageService(
    new ConfigService({
      R2_ACCOUNT_ID: 'test-account',
      R2_BUCKET: 'test-bucket',
      R2_ACCESS_KEY_ID: 'test-access-key',
      R2_SECRET_ACCESS_KEY: 'test-secret-key',
    }),
  );
}

describe('ObjectStorageService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows startup without R2 credentials but fails a storage operation clearly', async () => {
    const storage = new ObjectStorageService(new ConfigService({}));
    await expect(storage.head('key')).rejects.toThrow(
      'Media storage is not configured',
    );
  });

  it('binds PUT content type and length and uses the private R2 endpoint', async () => {
    const storage = configured();
    const signed = await storage.signPut('staging/image', 'image/jpeg', 321);
    const url = new URL(signed.url);
    expect(url.hostname).toBe(
      'test-bucket.test-account.r2.cloudflarestorage.com',
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-type',
    );
    expect(url.searchParams.get('X-Amz-SignedHeaders')).toContain(
      'content-length',
    );
    expect(new Date(signed.expiresAt).getTime()).toBeGreaterThan(Date.now());
    storage.onModuleDestroy();
  });

  it('encodes the original download filename in content disposition', async () => {
    const storage = configured();
    const { url } = await storage.signGet('media/id/original', {
      downloadName: '旅行 "写真".heic',
    });
    expect(
      new URL(url).searchParams.get('response-content-disposition'),
    ).toContain("filename*=UTF-8''%E6%97%85%E8%A1%8C");
    storage.onModuleDestroy();
  });

  it('downloads bytes as a stream and aborts files that exceed the allowed size', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'stamp-storage-'));
    const storage = configured();
    const send = vi.spyOn(S3Client.prototype, 'send');
    try {
      send.mockResolvedValueOnce({
        Body: Readable.from([Buffer.from('abc')]),
        ContentLength: 3,
      } as never);
      await storage.download('key', join(directory, 'success'), 3);
      expect(await readFile(join(directory, 'success'), 'utf8')).toBe('abc');
      send.mockResolvedValueOnce({
        Body: Readable.from([Buffer.from('abcd')]),
      } as never);
      await expect(
        storage.download('key', join(directory, 'oversized'), 3),
      ).rejects.toThrow('MEDIA_SIZE_EXCEEDED');
    } finally {
      storage.onModuleDestroy();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('lists every multipart page and preserves R2 part sizes for server validation', async () => {
    const storage = configured();
    const send = vi.spyOn(S3Client.prototype, 'send');
    send.mockResolvedValueOnce({
      Parts: [{ PartNumber: 1, ETag: '"first"', Size: 8_388_608 }],
      IsTruncated: true,
      NextPartNumberMarker: '1',
    } as never);
    send.mockResolvedValueOnce({
      Parts: [{ PartNumber: 2, ETag: '"second"', Size: 20 }],
      IsTruncated: false,
    } as never);
    expect(await storage.listParts('key', 'upload-id')).toEqual([
      { partNumber: 1, etag: '"first"', byteSize: 8_388_608 },
      { partNumber: 2, etag: '"second"', byteSize: 20 },
    ]);
    expect(send).toHaveBeenCalledTimes(2);
    storage.onModuleDestroy();
  });

  it('treats a partial R2 delete response as failure so cleanup can retry', async () => {
    const storage = configured();
    vi.spyOn(S3Client.prototype, 'send').mockResolvedValueOnce({
      Errors: [{ Key: 'key', Code: 'InternalError' }],
    } as never);
    await expect(storage.delete(['key'])).rejects.toThrow('could not delete');
    storage.onModuleDestroy();
  });
});
