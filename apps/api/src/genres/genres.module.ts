import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { GenreRepository } from './genre.repository.js';
import { GenresController } from './genres.controller.js';
import { GenresService } from './genres.service.js';

@Module({
  imports: [AuthModule, TripAccessModule],
  controllers: [GenresController],
  providers: [GenresService, GenreRepository],
})
export class GenresModule {}
