import { StorageModule } from '../storage/storage.module.js';
import { Module } from '@nestjs/common';
import { PostsService } from './posts.service.js';
import { PostsController } from './posts.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { PostRepository } from './post.repository.js';

@Module({
  imports: [AuthModule, TripAccessModule, StorageModule],
  controllers: [PostsController],
  providers: [PostsService, PostRepository],
})
export class PostsModule {}
