import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { MediaProcessor } from './media-processor.service.js';
import { MediaQueue } from './media-queue.service.js';

@Module({
  imports: [StorageModule],
  providers: [MediaProcessor, MediaQueue],
  exports: [StorageModule, MediaProcessor, MediaQueue],
})
export class MediaProcessingModule {}
