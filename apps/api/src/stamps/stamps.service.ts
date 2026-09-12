import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { ListStampsDto } from './dto/list-stamps.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';
import { InvalidStampError, Stamp } from './entities/stamp.entity.js';
import { StampRepository } from './stamp.repository.js';

@Injectable()
export class StampsService {
  constructor(
    private readonly stamps: StampRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreateStampDto): Promise<Stamp> {
    await this.access.requireTrip(userId, dto.tripId);
    return this.stamps.create(
      {
        tripId: dto.tripId,
        categoryIds: dto.categoryIds,
        ...this.validate(dto),
      },
      userId,
    );
  }

  async findAll(userId: string, query: ListStampsDto) {
    await this.access.requireCategory(userId, query.categoryId);
    return this.stamps.findAll(query, userId);
  }

  async findOne(userId: string, id: string): Promise<Stamp> {
    await this.access.requireStamp(userId, id);
    const stamp = await this.stamps.findById(id, userId);
    if (!stamp) throw new NotFoundException('Stamp not found');
    return stamp;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateStampDto,
  ): Promise<Stamp> {
    const current = await this.findOne(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    const values = this.validate({
      name: dto.name === undefined ? current.name : dto.name,
      description:
        dto.description === undefined ? current.description : dto.description,
    });
    return this.stamps.update(
      id,
      {
        categoryIds: dto.categoryIds,
        name: dto.name === undefined ? undefined : values.name,
        description:
          dto.description === undefined ? undefined : values.description,
      },
      userId,
    );
  }

  private validate(input: { name: string; description?: string }) {
    try {
      return Stamp.validate(input);
    } catch (error) {
      if (error instanceof InvalidStampError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
