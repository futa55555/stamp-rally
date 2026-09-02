import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { TripsModule } from './trips/trips.module.js';
import { StampsModule } from './stamps/stamps.module.js';
import { GenresModule } from './genres/genres.module.js';
import { PostsModule } from './posts/posts.module.js';

@Module({
  imports: [HealthModule, UsersModule, TeamsModule, TripsModule, StampsModule, GenresModule, PostsModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
