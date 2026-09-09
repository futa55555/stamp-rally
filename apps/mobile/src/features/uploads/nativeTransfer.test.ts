import { describe, expect, it, vi } from 'vitest';
import { transferFile } from './nativeTransfer';

const native = vi.hoisted(() => ({
  reads: vi.fn(),
  writes: vi.fn(),
  uploads: vi.fn(),
  deleted: vi.fn(),
  initialOffset: 0,
}));
vi.mock('expo-file-system', () => {
  class File {
    uri: string;
    name: string;
    exists = true;
    size = 1_000_000_000;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts
        .map((part) => (typeof part === 'string' ? part : part.uri))
        .join('/');
      this.name = this.uri.split('/').at(-1)!;
    }
    create() {}
    delete() {
      native.deleted(this.uri);
      this.exists = false;
    }
    open() {
      let position = 0;
      return {
        set offset(value: number) {
          position = value;
          native.initialOffset = value;
        },
        readBytes: (length: number) => {
          native.reads(position, length);
          position += length;
          return new Uint8Array(length);
        },
        writeBytes: (bytes: Uint8Array) => native.writes(bytes.byteLength),
        close() {},
      };
    }
    createUploadTask(url: string, options: { httpMethod: string }) {
      native.uploads(this.uri, url, options);
      return {
        uploadAsync: async () => ({
          status: 200,
          headers: { ETag: 'accepted-part' },
        }),
      };
    }
  }
  return {
    File,
    Directory: class {},
    FileMode: { ReadOnly: 'r', ReadWrite: 'w' },
    Paths: { cache: 'file:///cache' },
  };
});

describe('native multipart transfer', () => {
  it('reads only one missing range in bounded chunks and uploads its temporary file', async () => {
    const start = 800 * 1024 * 1024;
    const length = 16 * 1024 * 1024;
    const result = await transferFile({
      uri: 'file:///private/original',
      url: 'https://r2/part',
      mimeType: 'video/mp4',
      start,
      end: start + length,
      signal: new AbortController().signal,
      progress: () => {},
    });
    expect(native.initialOffset).toBe(start);
    expect(
      native.reads.mock.calls.reduce((sum, [, count]) => sum + count, 0),
    ).toBe(length);
    expect(Math.max(...native.reads.mock.calls.map(([, count]) => count))).toBe(
      256 * 1024,
    );
    expect(native.uploads).toHaveBeenCalledWith(
      expect.stringContaining('upload-part-original'),
      'https://r2/part',
      expect.objectContaining({ httpMethod: 'PUT', sessionType: 'foreground' }),
    );
    expect(result).toBe('accepted-part');
    expect(native.deleted).toHaveBeenCalledWith(
      expect.stringContaining('upload-part-original'),
    );
    expect(native.deleted).not.toHaveBeenCalledWith('file:///private/original');
  });
});
