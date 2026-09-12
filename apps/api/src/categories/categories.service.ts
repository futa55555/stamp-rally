import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { ListCategoriesDto } from './dto/list-categories.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { Category, InvalidCategoryError } from './entities/category.entity.js';
import { CategoryRepository } from './category.repository.js';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly categories: CategoryRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreateCategoryDto): Promise<Category> {
    await this.access.requireTrip(userId, dto.tripId);
    return this.categories.create(
      { tripId: dto.tripId, ...this.validate(dto) },
      userId,
    );
  }

  async findAll(userId: string, query: ListCategoriesDto) {
    await this.access.requireTrip(userId, query.tripId);
    return this.categories.findAll(query, userId);
  }

  async findOne(userId: string, id: string): Promise<Category> {
    await this.access.requireCategory(userId, id);
    const category = await this.categories.findById(id, userId);
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<Category> {
    const current = await this.findOne(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    const values = this.validate({
      name: dto.name === undefined ? current.name : dto.name,
      description:
        dto.description === undefined ? current.description : dto.description,
    });
    return this.categories.update(
      id,
      {
        name: dto.name === undefined ? undefined : values.name,
        description:
          dto.description === undefined ? undefined : values.description,
      },
      userId,
    );
  }

  private validate(input: { name: string; description?: string }) {
    try {
      return Category.validate(input);
    } catch (error) {
      if (error instanceof InvalidCategoryError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
