import { PaginationQueryDto } from '../common/pagination.js';
import {
  Get,
  Delete,
  HttpCode,
  Post,
  Body,
  Controller,
  Patch,
  Param,
  Query,
  Req,
  ParseUUIDPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { PostsService } from './posts.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { ListPostsDto } from './dto/list-posts.dto.js';
import { UpdateFavoriteDto } from './dto/update-favorite.dto.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreatePostDto) {
    return this.postsService.create(request.auth.userId, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query() query: ListPostsDto) {
    return this.postsService.findAll(request.auth.userId, query);
  }

  @Get('trash')
  trash(
    @Req() request: AuthenticatedRequest,
    @Query() query: PaginationQueryDto,
  ) {
    return this.postsService.trash(request.auth.userId, query);
  }
  @Get('trash/:id')
  trashDetail(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.trashDetail(request.auth.userId, id);
  }
  @Post(':id/restore')
  @HttpCode(200)
  restore(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.restore(request.auth.userId, id);
  }

  @Get(':id/original')
  original(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.original(request.auth.userId, id);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.findOne(request.auth.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.delete(request.auth.userId, id);
  }

  @Patch(':id/read')
  markRead(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.postsService.markRead(request.auth.userId, id);
  }

  @Patch(':id/favorite')
  setFavorite(
    @Req() request: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateFavoriteDto,
  ) {
    return this.postsService.setFavorite(
      request.auth.userId,
      id,
      dto.isFavorite,
    );
  }
}
