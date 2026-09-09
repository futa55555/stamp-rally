import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { MediaProcessingModule } from '../media-processing/media-processing.module.js';
import { UploadsController } from './uploads.controller.js';
import { UploadsService } from './uploads.service.js';
import { UploadLifecycleModule } from './upload-lifecycle.module.js';

@Module({
  imports: [
    AuthModule,
    TripAccessModule,
    StorageModule,
    MediaProcessingModule,
    UploadLifecycleModule,
  ],
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService, UploadLifecycleModule],
})
export class UploadsModule {}
