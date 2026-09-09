import {
  Injectable,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface SignedUrl {
  url: string;
  expiresAt: string;
}
export interface StoredPart {
  partNumber: number;
  etag: string;
  byteSize: number;
}
export interface ObjectMetadata {
  byteSize: number;
  contentType?: string;
  etag?: string;
}

/** Private R2 access. Configuration is lazy so unrelated API endpoints remain usable. */
@Injectable()
export class ObjectStorageService implements OnModuleDestroy {
  private client?: S3Client;
  constructor(private readonly config: ConfigService) {}

  private connection(): { client: S3Client; bucket: string } {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const endpoint =
      this.config.get<string>('R2_ENDPOINT') ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);
    const bucket = this.config.get<string>('R2_BUCKET');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'Media storage is not configured. Set R2_ACCOUNT_ID (or R2_ENDPOINT), R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.',
      );
    }
    this.client ??= new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return { client: this.client, bucket };
  }

  async signPut(
    key: string,
    contentType: string,
    byteSize: number,
  ): Promise<SignedUrl> {
    const { client, bucket } = this.connection();
    const seconds = 900;
    const url = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: byteSize,
      }),
      {
        expiresIn: seconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }

  async signGet(
    key: string,
    options?: { downloadName?: string },
  ): Promise<SignedUrl> {
    const { client, bucket } = this.connection();
    const seconds = 3600;
    const filename = options?.downloadName;
    const disposition = filename
      ? `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(filename).replace(/'/g, '%27')}`
      : undefined;
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: disposition,
      }),
      { expiresIn: seconds },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }

  async head(key: string): Promise<ObjectMetadata> {
    const { client, bucket } = this.connection();
    const result = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      byteSize: result.ContentLength ?? 0,
      contentType: result.ContentType,
      etag: result.ETag,
    };
  }

  async download(key: string, path: string, maxBytes: number): Promise<void> {
    const { client, bucket } = this.connection();
    const result = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { abortSignal: AbortSignal.timeout(15 * 60_000) },
    );
    if (!result.Body || (result.ContentLength ?? 0) > maxBytes) {
      (result.Body as Readable | undefined)?.destroy();
      throw new Error('MEDIA_SIZE_EXCEEDED');
    }
    let received = 0;
    const bound = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        received += chunk.length;
        callback(
          received > maxBytes ? new Error('MEDIA_SIZE_EXCEEDED') : null,
          chunk,
        );
      },
    });
    await pipeline(
      result.Body as Readable,
      bound,
      createWriteStream(path, { flags: 'wx', mode: 0o600 }),
      { signal: AbortSignal.timeout(15 * 60_000) },
    );
  }

  async uploadFile(
    key: string,
    path: string,
    contentType: string,
  ): Promise<void> {
    const { client, bucket } = this.connection();
    const { size } = await stat(path);
    const body = createReadStream(path);
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          ContentType: contentType,
          ContentLength: size,
          Body: body,
          CacheControl: 'private, max-age=3600',
        }),
        { abortSignal: AbortSignal.timeout(15 * 60_000) },
      );
    } finally {
      body.destroy();
    }
  }

  async copy(sourceKey: string, targetKey: string): Promise<void> {
    const { client, bucket } = this.connection();
    await client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        Key: targetKey,
        CopySource: `${encodeURIComponent(bucket)}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
      }),
    );
  }

  async listObjects(
    prefix: string,
    cursor?: string,
  ): Promise<{
    objects: Array<{ key: string; lastModified: Date }>;
    cursor?: string;
  }> {
    const { client, bucket } = this.connection();
    const result = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: cursor,
        MaxKeys: 1000,
      }),
    );
    return {
      objects: (result.Contents ?? [])
        .filter((item) => item.Key && item.LastModified)
        .map((item) => ({ key: item.Key!, lastModified: item.LastModified! })),
      cursor: result.IsTruncated ? result.NextContinuationToken : undefined,
    };
  }

  async delete(keys: string[]): Promise<void> {
    if (!keys.length) return;
    const { client, bucket } = this.connection();
    const uniqueKeys = [...new Set(keys)];
    for (let index = 0; index < uniqueKeys.length; index += 1000) {
      const result = await client.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: {
            Objects: uniqueKeys
              .slice(index, index + 1000)
              .map((Key) => ({ Key })),
            Quiet: true,
          },
        }),
      );
      if (result.Errors?.length)
        throw new Error(
          `R2 could not delete ${result.Errors.length} media objects`,
        );
    }
  }

  async createMultipart(key: string, contentType: string): Promise<string> {
    const { client, bucket } = this.connection();
    const result = await client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
      }),
    );
    if (!result.UploadId)
      throw new Error('R2 did not return a multipart upload ID');
    return result.UploadId;
  }

  async signPart(
    key: string,
    uploadId: string,
    partNumber: number,
  ): Promise<SignedUrl> {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000)
      throw new Error('Invalid multipart part number');
    const { client, bucket } = this.connection();
    const seconds = 900;
    const url = await getSignedUrl(
      client,
      new UploadPartCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: seconds },
    );
    return {
      url,
      expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }

  async listParts(key: string, uploadId: string): Promise<StoredPart[]> {
    const { client, bucket } = this.connection();
    const parts: StoredPart[] = [];
    let marker: string | undefined;
    do {
      const result = await client.send(
        new ListPartsCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: marker,
        }),
      );
      for (const part of result.Parts ?? []) {
        if (!part.PartNumber || !part.ETag || part.Size === undefined)
          throw new Error('R2 returned an invalid multipart part');
        parts.push({
          partNumber: part.PartNumber,
          etag: part.ETag,
          byteSize: part.Size,
        });
      }
      marker = result.IsTruncated ? result.NextPartNumberMarker : undefined;
    } while (marker);
    return parts;
  }

  async completeMultipart(
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<void> {
    const { client, bucket } = this.connection();
    await client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: [...parts]
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async abortMultipart(key: string, uploadId: string): Promise<void> {
    const { client, bucket } = this.connection();
    try {
      await client.send(
        new AbortMultipartUploadCommand({
          Bucket: bucket,
          Key: key,
          UploadId: uploadId,
        }),
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'NoSuchUpload')
        throw error;
    }
  }

  onModuleDestroy(): void {
    this.client?.destroy();
  }
}
