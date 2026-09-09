import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { CreateGenreDto } from './dto/create-genre.dto.js';
import { ListGenresDto } from './dto/list-genres.dto.js';
import { UpdateGenreDto } from './dto/update-genre.dto.js';
import { Genre, InvalidGenreError } from './entities/genre.entity.js';
import { GenreRepository } from './genre.repository.js';

@Injectable()
export class GenresService {
  constructor(
    private readonly genres: GenreRepository,
    private readonly access: TripAccessService,
  ) {}

  async create(userId: string, dto: CreateGenreDto): Promise<Genre> {
    await this.access.requireTrip(userId, dto.tripId);
    return this.genres.create(
      { tripId: dto.tripId, ...this.validate(dto) },
      userId,
    );
  }

  async findAll(userId: string, query: ListGenresDto) {
    await this.access.requireTrip(userId, query.tripId);
    return this.genres.findAll(query, userId);
  }

  async findOne(userId: string, id: string): Promise<Genre> {
    await this.access.requireGenre(userId, id);
    const genre = await this.genres.findById(id, userId);
    if (!genre) throw new NotFoundException('Genre not found');
    return genre;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateGenreDto,
  ): Promise<Genre> {
    const current = await this.findOne(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    const values = this.validate({
      name: dto.name === undefined ? current.name : dto.name,
      description:
        dto.description === undefined ? current.description : dto.description,
    });
    return this.genres.update(
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
      return Genre.validate(input);
    } catch (error) {
      if (error instanceof InvalidGenreError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }
}
