import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripTemplatesController } from './trip-templates.controller.js';
import { TripTemplatesService } from './trip-templates.service.js';

@Module({
  imports: [AuthModule],
  controllers: [TripTemplatesController],
  providers: [TripTemplatesService],
  exports: [TripTemplatesService],
})
export class TripTemplatesModule {}
