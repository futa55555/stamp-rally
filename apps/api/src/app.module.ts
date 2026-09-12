import { NotificationsModule } from './notifications/notifications.module.js';
import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module.js';
import { HealthModule } from './health/health.module.js';
import { PostsModule } from './posts/posts.module.js';
import { StampsModule } from './stamps/stamps.module.js';
import { InvitationsModule } from './invitations/invitations.module.js';
import { TripsModule } from './trips/trips.module.js';
import { UsersModule } from './users/users.module.js';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    CategoriesModule,
    HealthModule,
    PostsModule,
    NotificationsModule,
    StampsModule,
    InvitationsModule,
    TripsModule,
    UsersModule,
    AuthModule,
    UploadsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
