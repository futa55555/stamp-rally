import { BadRequestException, Injectable } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CommentRepository } from './comment.repository.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsDto } from './dto/list-comments.dto.js';
import { Comment, InvalidCommentTextError } from './entities/comment.entity.js';

@Injectable()
export class CommentsService {
  constructor(
    private readonly comments: CommentRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreateCommentDto): Promise<Comment> {
    await this.access.requireStamp(userId, dto.stampId);
    let text: string;
    try {
      text = Comment.normalizeText(dto.text);
    } catch (error) {
      if (error instanceof InvalidCommentTextError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
    return this.comments.create({
      stampId: dto.stampId,
      authorId: userId,
      text,
    });
  }

  async findAll(userId: string, query: ListCommentsDto) {
    await this.access.requireStamp(userId, query.stampId);
    return this.comments.list(query);
  }
}
