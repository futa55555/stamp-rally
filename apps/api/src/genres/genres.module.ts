import { Module } from '@nestjs/common';
import { GenresService } from './genres.service.js';
import { GenresController } from './genres.controller.js';

@Module({
  controllers: [GenresController],
  providers: [GenresService],
})
export class GenresModule {}
