import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Metadata } from 'sharp';
import { encode } from 'blurhash';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { runMediaCommand } from './run-media-command.js';
import { downloadLegacy } from './legacy-download.js';

export const IMAGE_MAX_BYTES = 50_000_000;
export const VIDEO_MAX_BYTES = 1_000_000_000;
export const MAX_IMAGE_PIXELS = 100_000_000;

export interface ProcessMediaInput {
  postId: string;
  version: number;
  mediaType: 'IMAGE' | 'VIDEO';
  stagingKey: string;
}
export interface ProcessedMedia {
  originalKey: string;
  largeKey: string;
  smallKey: string;
  playbackKey: string | null;
  blurhash: string;
  width: number;
  height: number;
  byteSize: number;
  mimeType: string;
  duration: number | null;
}
export class InvalidMediaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'InvalidMediaError';
  }
}
interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
  duration?: string;
  avg_frame_rate?: string;
  color_transfer?: string;
}
interface Probe {
  streams?: ProbeStream[];
  format?: {
    format_name?: string;
    duration?: string;
    tags?: { major_brand?: string };
  };
}

/** Runs only in the isolated worker, never in an HTTP request. */
@Injectable()
export class MediaProcessor {
  constructor(
    private readonly storage: ObjectStorageService,
    private readonly config: ConfigService,
  ) {}

  process(input: ProcessMediaInput): Promise<ProcessedMedia> {
    return this.processWithDownload(input, (path, maxBytes) =>
      this.storage.download(input.stagingKey, path, maxBytes),
    );
  }

  processLegacy(
    input: Omit<ProcessMediaInput, 'stagingKey'> & { url: string },
  ): Promise<ProcessedMedia> {
    const allowedOrigins = (
      this.config.get<string>('MEDIA_LEGACY_ALLOWED_ORIGINS') ?? ''
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    return this.processWithDownload(input, (path, maxBytes) =>
      downloadLegacy(input.url, path, maxBytes, allowedOrigins),
    );
  }

  private async processWithDownload(
    input: Omit<ProcessMediaInput, 'stagingKey'>,
    download: (path: string, maxBytes: number) => Promise<void>,
  ): Promise<ProcessedMedia> {
    const directory = await mkdtemp(join(tmpdir(), 'stamp-media-'));
    const original = join(directory, 'original');
    const prefix = `media/${input.postId}/${input.version}/${randomUUID()}`;
    const keys = {
      originalKey: `${prefix}/original`,
      largeKey: `${prefix}/large.webp`,
      smallKey: `${prefix}/small.webp`,
      playbackKey:
        input.mediaType === 'VIDEO' ? `${prefix}/playback.mp4` : null,
    };
    const attemptedKeys: string[] = [];
    try {
      const maxBytes =
        input.mediaType === 'IMAGE' ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
      await download(original, maxBytes);
      const { size: byteSize } = await stat(original);
      if (byteSize < 1 || byteSize > maxBytes)
        throw new InvalidMediaError('MEDIA_SIZE_EXCEEDED');
      let imagePath = original;
      let duration: number | null = null;
      let mimeType: string;
      if (input.mediaType === 'VIDEO') {
        const video = await this.prepareVideo(original, directory);
        duration = video.duration;
        mimeType = video.mimeType;
        imagePath = video.posterPath;
      } else {
        mimeType = await this.validateImage(original);
      }
      const largePath = join(directory, 'large.webp');
      const smallPath = join(directory, 'small.webp');
      const pipeline = sharp(imagePath, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'warning',
      })
        .timeout({ seconds: 120 })
        .autoOrient()
        .toColourspace('srgb');
      await pipeline
        .clone()
        .resize({
          width: 2560,
          height: 2560,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82 })
        .toFile(largePath);
      await pipeline
        .clone()
        .resize({
          width: 768,
          height: 768,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 78 })
        .toFile(smallPath);
      const metadata = await sharp(largePath).metadata();
      if (!metadata.width || !metadata.height)
        throw new InvalidMediaError('INVALID_IMAGE');
      const { data, info } = await sharp(smallPath)
        .resize({
          width: 32,
          height: 32,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const blurhash = encode(
        new Uint8ClampedArray(data),
        info.width,
        info.height,
        4,
        3,
      );
      // Upload the SAME local bytes that were decoded, never copy a mutable signed PUT target.
      const uploads: Array<[string, string, string]> = [
        [keys.originalKey, original, mimeType],
        [keys.largeKey, largePath, 'image/webp'],
        [keys.smallKey, smallPath, 'image/webp'],
      ];
      if (keys.playbackKey)
        uploads.push([
          keys.playbackKey,
          join(directory, 'playback.mp4'),
          'video/mp4',
        ]);
      for (const [key, path, type] of uploads) {
        attemptedKeys.push(key);
        await this.storage.uploadFile(key, path, type);
      }
      return {
        ...keys,
        blurhash,
        width: metadata.width,
        height: metadata.height,
        byteSize,
        mimeType,
        duration,
      };
    } catch (error) {
      if (attemptedKeys.length) {
        // R2 lifecycle cleanup is a final safety net for a worker terminated during an upload.
        await this.storage.delete(attemptedKeys).catch(() => undefined);
      }
      throw error;
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  private async validateImage(path: string): Promise<string> {
    let metadata: Metadata;
    try {
      metadata = await sharp(path, {
        limitInputPixels: MAX_IMAGE_PIXELS,
        failOn: 'warning',
      }).metadata();
    } catch {
      throw new InvalidMediaError('INVALID_IMAGE');
    }
    if ((metadata.pages ?? 1) > 1)
      throw new InvalidMediaError('ANIMATED_IMAGE_UNSUPPORTED');
    if (!metadata.width || !metadata.height)
      throw new InvalidMediaError('INVALID_IMAGE');
    switch (metadata.format) {
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'heif':
        return metadata.compression === 'av1' ? 'image/avif' : 'image/heic';
      default:
        throw new InvalidMediaError('UNSUPPORTED_IMAGE_FORMAT');
    }
  }

  private async prepareVideo(
    original: string,
    directory: string,
  ): Promise<{ duration: number; mimeType: string; posterPath: string }> {
    const ffprobe = this.config.get<string>('FFPROBE_PATH') || 'ffprobe';
    const ffmpeg = this.config.get<string>('FFMPEG_PATH') || 'ffmpeg';
    let probe: Probe;
    try {
      const output = await runMediaCommand(
        ffprobe,
        [
          '-v',
          'error',
          '-max_alloc',
          '268435456',
          '-protocol_whitelist',
          'file,pipe',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          original,
        ],
        60_000,
      );
      probe = JSON.parse(output) as Probe;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
      throw new InvalidMediaError('INVALID_VIDEO');
    }
    const video = probe.streams?.find(
      (stream) => stream.codec_type === 'video',
    );
    if (
      !probe.format?.format_name?.split(',').includes('mov') ||
      !video ||
      !['h264', 'hevc'].includes(video.codec_name ?? '')
    )
      throw new InvalidMediaError('UNSUPPORTED_VIDEO_FORMAT');
    const brand = probe.format.tags?.major_brand?.trim();
    if (
      brand &&
      ![
        'qt',
        'isom',
        'iso2',
        'iso3',
        'iso4',
        'iso5',
        'iso6',
        'iso7',
        'iso8',
        'iso9',
        'mp41',
        'mp42',
        'avc1',
        'hvc1',
        'hev1',
        'M4V',
        'MSNV',
        'dby1',
      ].includes(brand)
    )
      throw new InvalidMediaError('UNSUPPORTED_VIDEO_FORMAT');
    const durations = [
      Number(probe.format.duration),
      ...(probe.streams ?? []).map((stream) => Number(stream.duration)),
    ].filter(Number.isFinite);
    const duration = Math.max(...durations);
    if (!(duration > 0) || duration > 300)
      throw new InvalidMediaError('VIDEO_DURATION_EXCEEDED');
    if (
      !video.width ||
      !video.height ||
      video.width * video.height > MAX_IMAGE_PIXELS
    )
      throw new InvalidMediaError('INVALID_VIDEO_DIMENSIONS');
    const [numerator, denominator] = (video.avg_frame_rate ?? '30/1')
      .split('/')
      .map(Number);
    const sourceFps = numerator / denominator;
    const fps =
      Number.isFinite(sourceFps) && sourceFps > 0
        ? Math.min(sourceFps, 30)
        : 30;
    const hdr = ['smpte2084', 'arib-std-b67'].includes(
      video.color_transfer ?? '',
    );
    const colors = hdr
      ? 'zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv,sidedata=mode=delete:type=MASTERING_DISPLAY_METADATA,sidedata=mode=delete:type=CONTENT_LIGHT_LEVEL,'
      : '';
    const size = 'min(1,min(1920/max(iw*sar,ih),1080/min(iw*sar,ih)))';
    const scale = `scale=w='max(2,trunc(iw*sar*${size}/2)*2)':h='max(2,trunc(ih*${size}/2)*2)',setsar=1`;
    const playbackPath = join(directory, 'playback.mp4');
    await runMediaCommand(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-xerror',
        '-max_alloc',
        '268435456',
        '-protocol_whitelist',
        'file,pipe',
        '-threads',
        '2',
        '-i',
        original,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-map_metadata',
        '-1',
        '-map_chapters',
        '-1',
        '-vf',
        `${colors}${scale},fps=${fps},format=yuv420p`,
        '-c:v',
        'libx264',
        '-threads',
        '2',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-maxrate',
        '8M',
        '-bufsize',
        '16M',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-ac',
        '2',
        '-color_primaries',
        'bt709',
        '-color_trc',
        'bt709',
        '-colorspace',
        'bt709',
        '-metadata:s:v:0',
        'rotate=0',
        '-movflags',
        '+faststart',
        '-f',
        'mp4',
        '-y',
        playbackPath,
      ],
      30 * 60_000,
    );
    const posterPath = join(directory, 'poster.png');
    const timestamp = Math.min(
      duration < 1 ? duration / 2 : 1,
      Math.max(0, duration - 1 / fps),
    );
    // Decode the SDR playback so the poster has exactly the same orientation and tone mapping.
    await runMediaCommand(
      ffmpeg,
      [
        '-hide_banner',
        '-loglevel',
        'error',
        '-nostdin',
        '-protocol_whitelist',
        'file,pipe',
        '-ss',
        String(timestamp),
        '-i',
        playbackPath,
        '-frames:v',
        '1',
        '-y',
        posterPath,
      ],
      60_000,
    );
    if (!(await readFile(posterPath)).length)
      throw new InvalidMediaError('INVALID_VIDEO_POSTER');
    return {
      duration,
      mimeType: !brand || brand === 'qt' ? 'video/quicktime' : 'video/mp4',
      posterPath,
    };
  }
}
