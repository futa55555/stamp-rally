import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TripAccessService } from './trip-access.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [TripAccessService],
  exports: [TripAccessService],
})
export class TripAccessModule {}
