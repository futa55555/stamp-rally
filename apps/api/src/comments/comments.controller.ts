import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { CommentsService } from './comments.service.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { ListCommentsDto } from './dto/list-comments.dto.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(request.auth.userId, dto);
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCommentsDto,
  ) {
    return this.commentsService.findAll(request.auth.userId, query);
  }
}
