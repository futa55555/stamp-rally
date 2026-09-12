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
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { CategoriesService } from './categories.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(request.auth.userId, dto);
  }

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query() query: ListCategoriesDto,
  ) {
    return this.categoriesService.findAll(request.auth.userId, query);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.categoriesService.findOne(request.auth.userId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(request.auth.userId, id, dto);
  }
}
