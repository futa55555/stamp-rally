import type { PaginationQueryDto } from '../common/pagination.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsDto, postScope } from './dto/list-posts.dto.js';
import { Post } from './entities/post.entity.js';
import { PostRepository } from './post.repository.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly posts: PostRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    await this.access.requireStamp(userId, dto.stampId);

    throw new BadRequestException(
      'Direct media URLs are no longer accepted. Create an upload with POST /uploads/batches.',
    );
  }

  async findAll(userId: string, query: ListPostsDto) {
    const scope = postScope(query);
    if (scope.type === 'trip') await this.access.requireTrip(userId, scope.id);
    else if (scope.type === 'category')
      await this.access.requireCategory(userId, scope.id);
    else await this.access.requireStamp(userId, scope.id);
    return this.posts.list(scope, query, userId);
  }

  async findOne(userId: string, id: string): Promise<Post> {
    await this.access.requirePost(userId, id);
    const post = await this.posts.findById(id, userId);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async markRead(userId: string, id: string): Promise<Post> {
    await this.findOne(userId, id);
    return this.posts.markRead(id, userId);
  }

  async original(userId: string, id: string) {
    await this.access.requirePost(userId, id);
    return this.posts.original(id, userId);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.posts.delete(id, userId);
  }

  trash(userId: string, query: PaginationQueryDto) {
    return this.posts.trash(userId, query);
  }
  trashDetail(userId: string, id: string) {
    return this.posts.trashDetail(id, userId);
  }
  restore(userId: string, id: string) {
    return this.posts.restore(id, userId);
  }

  async setFavorite(
    userId: string,
    id: string,
    isFavorite: boolean,
  ): Promise<Post> {
    await this.access.requirePost(userId, id);
    if (typeof isFavorite !== 'boolean') {
      throw new BadRequestException('isFavorite must be a boolean');
    }
    return this.posts.setFavorite(id, isFavorite, userId);
  }
}
