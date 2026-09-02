import { Module } from '@nestjs/common';
import { GenresModule } from './genres/genres.module.js';
import { HealthModule } from './health/health.module.js';
import { PostsModule } from './posts/posts.module.js';
import { StampsModule } from './stamps/stamps.module.js';
import { TeamsModule } from './teams/teams.module.js';
import { TripsModule } from './trips/trips.module.js';
import { UsersModule } from './users/users.module.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    GenresModule,
    HealthModule,
    PostsModule,
    StampsModule,
    TeamsModule,
    TripsModule,
    UsersModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
