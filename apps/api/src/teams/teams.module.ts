import { Module } from '@nestjs/common';
import { TeamsService } from './teams.service.js';
import { TeamsController } from './teams.controller.js';

@Module({
  controllers: [TeamsController],
  providers: [TeamsService],
})
export class TeamsModule {}
