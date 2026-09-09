import { ConfigService } from '@nestjs/config';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { isBlurhashValid } from 'blurhash';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { MediaProcessor } from './media-processor.service.js';
import { runMediaCommand } from './run-media-command.js';

function setup(input: Buffer) {
  const uploaded = new Map<string, { data: Buffer; contentType: string }>();
  const storage = {
    download: vi.fn(async (_key: string, path: string) => {
      await writeFile(path, input);
    }),
    uploadFile: vi.fn(
      async (key: string, path: string, contentType: string) => {
        uploaded.set(key, { data: await readFile(path), contentType });
      },
    ),
    delete: vi.fn(async (keys: string[]) => {
      keys.forEach((key) => uploaded.delete(key));
    }),
  };
  const processor = new MediaProcessor(
    storage as unknown as ObjectStorageService,
    new ConfigService(),
  );
  return { processor, uploaded, storage };
}
const request = {
  postId: 'post-id',
  version: 1,
  mediaType: 'IMAGE' as const,
  stagingKey: 'staging/photo',
};

describe('MediaProcessor real image conversion', () => {
  it('stores only a bounded WebP for a cropped cover and strips source metadata', async () => {
    const input = await sharp({
      create: {
        width: 3200,
        height: 2000,
        channels: 4,
        background: '#ff000080',
      },
    })
      .png()
      .toBuffer();
    const { processor, uploaded } = setup(input);
    const result = await processor.processCover(
      'cover',
      1,
      'covers/staging/cover',
    );
    expect(uploaded.size).toBe(1);
    expect(result.imageKey).toMatch(/^covers\/cover\/1\//);
    expect(result).toMatchObject({ width: 2560, height: 1600 });
    expect(
      await sharp(uploaded.get(result.imageKey)!.data).metadata(),
    ).toMatchObject({
      format: 'webp',
      width: 2560,
      height: 1600,
      hasAlpha: true,
    });
    expect(isBlurhashValid(result.blurhash).result).toBe(true);
  });

  it('rejects a cover with the wrong crop ratio or file type before publication', async () => {
    for (const input of [
      await sharp({
        create: { width: 800, height: 800, channels: 3, background: '#fff' },
      })
        .png()
        .toBuffer(),
      await sharp({
        create: { width: 800, height: 500, channels: 3, background: '#fff' },
      })
        .jpeg()
        .toBuffer(),
    ]) {
      const { processor, uploaded } = setup(input);
      await expect(
        processor.processCover('cover', 1, 'staging'),
      ).rejects.toThrow('INVALID_COVER_IMAGE');
      expect(uploaded.size).toBe(0);
    }
  });

  it('keeps original bytes and panorama ratio while bounding both display sizes', async () => {
    const input = await sharp({
      create: { width: 6000, height: 1000, channels: 3, background: '#456789' },
    })
      .jpeg()
      .toBuffer();
    const { processor, uploaded } = setup(input);
    const result = await processor.process(request);
    expect(uploaded.get(result.originalKey)?.data).toEqual(input);
    expect(uploaded.size).toBe(3);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.byteSize).toBe(input.length);
    expect(result.duration).toBeNull();
    expect(result.playbackKey).toBeNull();
    expect(isBlurhashValid(result.blurhash).result).toBe(true);
    expect(
      await sharp(uploaded.get(result.largeKey)!.data).metadata(),
    ).toMatchObject({ width: 2560, height: 427, format: 'webp' });
    expect(
      await sharp(uploaded.get(result.smallKey)!.data).metadata(),
    ).toMatchObject({ width: 768, height: 128, format: 'webp' });
  });

  it('applies EXIF orientation, strips metadata, and never enlarges a small image', async () => {
    const input = await sharp({
      create: { width: 200, height: 100, channels: 3, background: '#884422' },
    })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const { processor, uploaded } = setup(input);
    const result = await processor.process(request);
    expect(result).toMatchObject({ width: 100, height: 200 });
    expect(
      (await sharp(uploaded.get(result.smallKey)!.data).metadata()).orientation,
    ).toBeUndefined();
    expect(uploaded.get(result.originalKey)?.data).toEqual(input);
  });

  it('preserves transparent PNG pixels in WebP and creates a usable blurhash', async () => {
    const input = await sharp({
      create: { width: 20, height: 30, channels: 4, background: '#ff000080' },
    })
      .png()
      .toBuffer();
    const { processor, uploaded } = setup(input);
    const result = await processor.process(request);
    expect(
      await sharp(uploaded.get(result.smallKey)!.data).metadata(),
    ).toMatchObject({ width: 20, height: 30, hasAlpha: true });
    expect(isBlurhashValid(result.blurhash).result).toBe(true);
  });

  it('accepts AVIF by its decoded compression rather than its file extension', async () => {
    const input = await sharp({
      create: { width: 32, height: 24, channels: 3, background: '#4477aa' },
    })
      .avif()
      .toBuffer();
    const { processor } = setup(input);
    expect((await processor.process(request)).mimeType).toBe('image/avif');
  });

  it.each([
    Buffer.from('corrupt image'),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>',
    ),
  ])(
    'rejects invalid or unsupported content before writing R2 objects',
    async (input) => {
      const { processor, storage } = setup(input);
      await expect(processor.process(request)).rejects.toThrow();
      expect(storage.uploadFile).not.toHaveBeenCalled();
    },
  );

  it('removes every attempted output after an object upload fails', async () => {
    const input = await sharp({
      create: { width: 20, height: 30, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const { processor, storage, uploaded } = setup(input);
    storage.uploadFile.mockImplementationOnce(
      async (key, path, contentType) => {
        uploaded.set(key, { data: await readFile(path), contentType });
      },
    );
    storage.uploadFile.mockImplementationOnce(async () => {
      throw new Error('R2 unavailable');
    });
    await expect(processor.process(request)).rejects.toThrow('R2 unavailable');
    expect(storage.delete.mock.calls[0][0]).toHaveLength(2);
    expect(uploaded.size).toBe(0);
  });

  it('uses fresh private object names for a repeated processing attempt', async () => {
    const input = await sharp({
      create: { width: 20, height: 30, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    const { processor } = setup(input);
    const first = await processor.process(request);
    const second = await processor.process(request);
    expect(first.originalKey).not.toBe(second.originalKey);
    expect(first.originalKey.startsWith('media/post-id/1/')).toBe(true);
  });
});

// Run in the worker image: MEDIA_CODEC_TESTS=1 pnpm exec vitest run src/media-processing/media-processor.service.spec.ts
describe.skipIf(process.env.MEDIA_CODEC_TESTS !== '1')(
  'MediaProcessor native HEIC and video codecs',
  () => {
    let directory: string;
    beforeEach(async () => {
      directory = await mkdtemp(join(tmpdir(), 'stamp-codec-test-'));
    });
    afterEach(async () => {
      await rm(directory, { recursive: true, force: true });
    });

    it('decodes actual HEVC-compressed HEIC originals', async () => {
      const input = await sharp({
        create: { width: 128, height: 96, channels: 3, background: '#4477aa' },
      })
        .heif({
          compression: 'hevc',
          quality: 50,
          chromaSubsampling: '4:2:0',
          tune: 'ssim',
        })
        .toBuffer();
      const { processor, uploaded } = setup(input);
      const result = await processor.process(request);
      expect(result.mimeType).toBe('image/heic');
      expect(uploaded.get(result.originalKey)?.data).toEqual(input);
      expect(
        await sharp(uploaded.get(result.largeKey)!.data).metadata(),
      ).toMatchObject({ format: 'webp', width: 128, height: 96 });
    });

    it('transcodes a short portrait video with audio and limits 60 fps to 30 fps', async () => {
      const source = join(directory, 'portrait.mp4');
      await runMediaCommand(
        'ffmpeg',
        [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          'testsrc2=size=64x96:rate=60',
          '-f',
          'lavfi',
          '-i',
          'sine=frequency=1000',
          '-t',
          '0.4',
          '-c:v',
          'libx264',
          '-c:a',
          'aac',
          '-y',
          source,
        ],
        60_000,
      );
      const input = await readFile(source);
      const { processor, uploaded } = setup(input);
      const result = await processor.process({
        ...request,
        mediaType: 'VIDEO',
      });
      expect(uploaded.size).toBe(4);
      expect(result).toMatchObject({
        mimeType: 'video/mp4',
        width: 64,
        height: 96,
      });
      expect(result.duration).toBeCloseTo(0.4, 1);
      expect(uploaded.get(result.originalKey)?.data).toEqual(input);
      const playback = join(directory, 'playback.mp4');
      await writeFile(playback, uploaded.get(result.playbackKey!)!.data);
      const probe = JSON.parse(
        await runMediaCommand(
          'ffprobe',
          ['-v', 'error', '-show_streams', '-of', 'json', playback],
          60_000,
        ),
      );
      expect(probe.streams[0]).toMatchObject({
        codec_name: 'h264',
        width: 64,
        height: 96,
        avg_frame_rate: '30/1',
        color_transfer: 'bt709',
      });
      expect(probe.streams[1].codec_name).toBe('aac');
    });

    it('tone maps HEVC HDR to SDR, generates a poster for exactly one second, and strips HDR metadata', async () => {
      const source = join(directory, 'hdr.mov');
      await runMediaCommand(
        'ffmpeg',
        [
          '-v',
          'error',
          '-f',
          'lavfi',
          '-i',
          'testsrc2=size=96x64:rate=15',
          '-t',
          '1',
          '-pix_fmt',
          'yuv420p10le',
          '-c:v',
          'libx265',
          '-x265-params',
          'pools=1:log-level=error',
          '-color_primaries',
          'bt2020',
          '-color_trc',
          'smpte2084',
          '-colorspace',
          'bt2020nc',
          '-y',
          source,
        ],
        60_000,
      );
      const { processor, uploaded } = setup(await readFile(source));
      const result = await processor.process({
        ...request,
        mediaType: 'VIDEO',
      });
      expect(result).toMatchObject({
        mimeType: 'video/quicktime',
        width: 96,
        height: 64,
      });
      expect(uploaded.size).toBe(4);
      expect(isBlurhashValid(result.blurhash).result).toBe(true);
    });
  },
);
