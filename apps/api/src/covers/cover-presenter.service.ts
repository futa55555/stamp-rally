import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';

@Injectable()
export class CoverPresenter {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: ObjectStorageService,
  ) {}
  async present<
    T extends { coverImageUrl: string | null; coverAssetId?: string | null },
  >(trip: T): Promise<T & { coverBlurhash: string | null }> {
    const asset = trip.coverAssetId
      ? await this.prisma.coverAsset.findUnique({
          where: { id: trip.coverAssetId },
        })
      : null;
    return {
      ...trip,
      coverImageUrl: asset
        ? asset.status === 'READY' && asset.imageKey
          ? (await this.storage.signGet(asset.imageKey)).url
          : null
        : trip.coverImageUrl,
      coverBlurhash: asset?.blurhash ?? null,
    };
  }
}
