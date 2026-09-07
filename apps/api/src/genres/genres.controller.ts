import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { ListGenresDto } from './dto/list-genres.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { GenresService } from './genres.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('genres')
export class GenresController {
  constructor(private readonly genresService: GenresService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateGenreDto) {
    return this.genresService.create(request.auth.userId, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query() query: ListGenresDto) {
    return this.genresService.findAll(request.auth.userId, query);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.genresService.findOne(request.auth.userId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGenreDto,
  ) {
    return this.genresService.update(request.auth.userId, id, dto);
  }
}
