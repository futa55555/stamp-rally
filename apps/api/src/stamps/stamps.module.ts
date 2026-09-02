import { Module } from '@nestjs/common';
import { StampsService } from './stamps.service.js';
import { StampsController } from './stamps.controller.js';

@Module({
  controllers: [StampsController],
  providers: [StampsService],
})
export class StampsModule {}
