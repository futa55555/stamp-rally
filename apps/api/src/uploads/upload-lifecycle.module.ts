import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MediaProcessingModule } from '../media-processing/media-processing.module.js';
import { UploadLifecycleService } from './upload-lifecycle.service.js';

// Shared by HTTP API and the worker; codec workers do not need auth secrets.
@Module({
  imports: [DatabaseModule, MediaProcessingModule],
  providers: [UploadLifecycleService],
  exports: [UploadLifecycleService, MediaProcessingModule],
})
export class UploadLifecycleModule {}
