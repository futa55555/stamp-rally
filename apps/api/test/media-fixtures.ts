import { randomUUID } from 'node:crypto';
import type {
  ObjectMetadata,
  StoredPart,
} from '../src/storage/object-storage.service.js';

/** Test-only S3 boundary. Domain integration tests still exercise real PostgreSQL. */
export class TestObjectStorage {
  readonly objects = new Map<string, ObjectMetadata>();
  readonly multipart = new Map<
    string,
    { key: string; contentType: string; parts: StoredPart[] }
  >();
  readonly deleted: string[] = [];

  reset() {
    this.objects.clear();
    this.multipart.clear();
    this.deleted.length = 0;
  }

  private signed(key: string) {
    return {
      url: `https://media.example.test/${encodeURIComponent(key)}?signature=test`,
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
    };
  }

  signPut(key: string) {
    return Promise.resolve(this.signed(key));
  }
  signGet(key: string) {
    return Promise.resolve(this.signed(key));
  }
  signPart(key: string, _uploadId: string, partNumber: number) {
    return Promise.resolve(this.signed(`${key}/part/${partNumber}`));
  }

  listObjects() {
    return Promise.resolve({ objects: [], cursor: undefined });
  }

  head(key: string) {
    const object = this.objects.get(key);
    if (!object)
      return Promise.reject(
        Object.assign(new Error('Not found'), { name: 'NotFound' }),
      );
    return Promise.resolve(object);
  }

  createMultipart(key: string, contentType: string) {
    const id = randomUUID();
    this.multipart.set(id, { key, contentType, parts: [] });
    return Promise.resolve(id);
  }

  listParts(_key: string, uploadId: string) {
    return Promise.resolve(this.multipart.get(uploadId)?.parts ?? []);
  }

  completeMultipart(key: string, uploadId: string) {
    const upload = this.multipart.get(uploadId);
    if (!upload) return Promise.reject(new Error('NoSuchUpload'));
    this.objects.set(key, {
      contentType: upload.contentType,
      byteSize: upload.parts.reduce((sum, part) => sum + part.byteSize, 0),
      etag: 'completed-etag',
    });
    this.multipart.delete(uploadId);
    return Promise.resolve();
  }

  abortMultipart(_key: string, uploadId: string) {
    this.multipart.delete(uploadId);
    return Promise.resolve();
  }

  copy(source: string, target: string) {
    const object = this.objects.get(source);
    if (!object) return Promise.reject(new Error('NotFound'));
    this.objects.set(target, { ...object });
    return Promise.resolve();
  }

  delete(keys: string[]) {
    for (const key of keys) {
      this.deleted.push(key);
      this.objects.delete(key);
    }
    return Promise.resolve();
  }
}

export class TestMediaQueue {
  readonly jobs: Array<{ postId: string; version: number }> = [];
  enqueueProcess(postId: string, version: number) {
    this.jobs.push({ postId, version });
    return Promise.resolve();
  }
  enqueueCover(_id: string) {
    return Promise.resolve();
  }
  enqueueCleanup() {
    return Promise.resolve();
  }
  enqueueLegacy(_postId: string) {
    return Promise.resolve();
  }
}

/** Encoding itself is exercised by the processor tests, not these HTTP tests. */
export class TestMediaProcessor {
  constructor(private readonly storage: TestObjectStorage) {}

  async processCover(id: string, attempt: number, stagingKey: string) {
    await this.storage.head(stagingKey);
    const imageKey = `covers/${id}/${attempt}/large.webp`;
    this.storage.objects.set(imageKey, {
      byteSize: 50,
      contentType: 'image/webp',
    });
    return {
      imageKey,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      width: 1600,
      height: 1000,
    };
  }

  async processLegacy(input: {
    postId: string;
    version: number;
    mediaType: 'IMAGE' | 'VIDEO';
    url: string;
  }) {
    const stagingKey = `test-legacy/${input.postId}`;
    this.storage.objects.set(stagingKey, {
      byteSize: 100,
      contentType: 'image/jpeg',
    });
    return this.process({ ...input, stagingKey });
  }

  async process(input: {
    postId: string;
    version: number;
    mediaType: 'IMAGE' | 'VIDEO';
    stagingKey: string;
  }) {
    const object = await this.storage.head(input.stagingKey);
    const prefix = `media/${input.postId}/${input.version}`;
    const video = input.mediaType === 'VIDEO';
    return {
      originalKey: `${prefix}/original`,
      largeKey: `${prefix}/large.webp`,
      smallKey: `${prefix}/small.webp`,
      playbackKey: video ? `${prefix}/playback.mp4` : null,
      blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
      width: video ? 1920 : 1280,
      height: video ? 1080 : 960,
      byteSize: object.byteSize,
      mimeType: object.contentType ?? (video ? 'video/mp4' : 'image/jpeg'),
      duration: video ? 5 : null,
    };
  }
}
