import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { DeletionsController } from './deletions.controller.js';
import { DeletionsService } from './deletions.service.js';

@Module({
  imports: [AuthModule, TripAccessModule],
  controllers: [DeletionsController],
  providers: [DeletionsService],
})
export class DeletionsModule {}
