import { CoverAssetsModule } from '../covers/cover-assets.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from './trip-access.module.js';
import { TripRepository } from './trip.repository.js';
import { TripsController } from './trips.controller.js';
import { TripsService } from './trips.service.js';
import { TripTemplatesModule } from '../trip-templates/trip-templates.module.js';

@Module({
  imports: [
    CoverAssetsModule,
    AuthModule,
    TripAccessModule,
    TripTemplatesModule,
  ],
  controllers: [TripsController],
  providers: [TripsService, TripRepository],
})
export class TripsModule {}
