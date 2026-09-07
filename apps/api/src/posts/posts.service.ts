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
    return this.posts.list(scope, query);
  }

  async findOne(userId: string, id: string): Promise<Post> {
    await this.access.requirePost(userId, id);
    const post = await this.posts.findById(id);
    if (!post) throw new NotFoundException('Post not found');
    return post;
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
    return this.posts.setFavorite(id, isFavorite);
  }
}
