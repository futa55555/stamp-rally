import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { MediaProcessingModule } from '../media-processing/media-processing.module.js';
import { CoverAssetsService } from './cover-assets.service.js';
import { CoverPresenter } from './cover-presenter.service.js';

@Module({
  imports: [DatabaseModule, MediaProcessingModule],
  providers: [CoverAssetsService, CoverPresenter],
  exports: [CoverAssetsService, CoverPresenter],
})
export class CoverAssetsModule {}
