import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { PrismaService } from './database/prisma.service.js';
import { MediaProcessingModule } from './media-processing/media-processing.module.js';
import { MediaQueue } from './media-processing/media-queue.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    MediaProcessingModule,
  ],
})
class MediaBackfillModule {}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== '--retry-failed')) {
    throw new Error('Usage: pnpm --filter api media:backfill [--retry-failed]');
  }
  const app = await NestFactory.createApplicationContext(MediaBackfillModule);
  try {
    const origins = (
      app.get(ConfigService).get<string>('MEDIA_LEGACY_ALLOWED_ORIGINS') ?? ''
    )
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (!origins.length)
      throw new Error(
        'Set MEDIA_LEGACY_ALLOWED_ORIGINS before importing existing media.',
      );
    for (const origin of origins) {
      const url = new URL(origin);
      if (
        url.protocol !== 'https:' ||
        url.origin !== origin ||
        url.username ||
        url.password
      ) {
        throw new Error(
          'MEDIA_LEGACY_ALLOWED_ORIGINS must contain exact HTTPS origins.',
        );
      }
    }
    const prisma = app.get(PrismaService);
    const queue = app.get(MediaQueue);
    let cursor: string | undefined;
    let count = 0;
    while (true) {
      const rows = await prisma.post.findMany({
        where: {
          isLegacy: true,
          mediaUrl: { not: null },
          status: {
            in: args.includes('--retry-failed')
              ? ['LEGACY', 'FAILED']
              : ['LEGACY'],
          },
        },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (!rows.length) break;
      for (const row of rows) {
        await queue.enqueueLegacy(row.id);
        count++;
      }
      cursor = rows.at(-1)!.id;
    }
    console.log(
      `Queued ${count} legacy media imports. Run the media worker to process them.`,
    );
  } finally {
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Media backfill failed',
  );
  process.exitCode = 1;
});
