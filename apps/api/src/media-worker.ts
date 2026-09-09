import { CoverAssetsModule } from './covers/cover-assets.module.js';
import { CoverAssetsService } from './covers/cover-assets.service.js';
import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DatabaseModule } from './database/database.module.js';
import { MediaQueue } from './media-processing/media-queue.service.js';
import { UploadLifecycleModule } from './uploads/upload-lifecycle.module.js';
import { UploadLifecycleService } from './uploads/upload-lifecycle.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    UploadLifecycleModule,
    CoverAssetsModule,
  ],
})
class MediaWorkerModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(MediaWorkerModule);
  app.enableShutdownHooks();
  try {
    const queue = app.get(MediaQueue);
    const lifecycle = app.get(UploadLifecycleService);
    const covers = app.get(CoverAssetsService);
    await queue.startWorkers({
      cover: (id) => covers.process(id),
      process: (postId, version) => lifecycle.process(postId, version),
      cleanup: async () => {
        await covers.cleanup();
        await lifecycle.cleanup();
      },
      migrateLegacy: (postId) => lifecycle.migrateLegacy(postId),
    });
  } catch (error) {
    await app.close();
    throw error;
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Media worker failed to start',
  );
  process.exitCode = 1;
});
