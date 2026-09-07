import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { StampRepository } from './stamp.repository.js';
import { StampsController } from './stamps.controller.js';
import { StampsService } from './stamps.service.js';

@Module({
  imports: [AuthModule, TripAccessModule],
  controllers: [StampsController],
  providers: [StampsService, StampRepository],
})
export class StampsModule {}
