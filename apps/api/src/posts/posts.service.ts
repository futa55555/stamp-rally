import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsDto, postScope } from './dto/list-posts.dto.js';
import { InvalidPostMediaError, Post } from './entities/post.entity.js';
import { PostRepository } from './post.repository.js';

@Injectable()
export class PostsService {
  constructor(
    private readonly posts: PostRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreatePostDto): Promise<Post> {
    await this.access.requireStamp(userId, dto.stampId);

    let mediaUrl: string;
    try {
      mediaUrl = Post.validateMedia(dto.mediaType, dto.mediaUrl);
    } catch (error) {
      if (error instanceof InvalidPostMediaError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    return this.posts.create({
      stampId: dto.stampId,
      authorId: userId,
      mediaType: dto.mediaType,
      mediaUrl,
    });
  }

  async findAll(userId: string, query: ListPostsDto) {
    const scope = postScope(query);
    if (scope.type === 'trip') await this.access.requireTrip(userId, scope.id);
    else if (scope.type === 'genre')
      await this.access.requireGenre(userId, scope.id);
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
    const post = await this.findOne(userId, id);
    if (post.mediaType !== 'IMAGE')
      throw new BadRequestException('Only photos can be marked read');
    return this.posts.markRead(id, userId);
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.access.requirePost(userId, id);
    await this.posts.delete(id);
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
