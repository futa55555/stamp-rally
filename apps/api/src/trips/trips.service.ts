import { Prisma } from '../generated/prisma/client.js';
import { CoverAssetsService } from '../covers/cover-assets.service.js';
import { CoverPresenter } from '../covers/cover-presenter.service.js';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { notifyMembers } from '../notifications/notify.js';
import { PrismaService } from '../database/prisma.service.js';
import { type PaginationQueryDto } from '../common/pagination.js';
import { serializable } from '../database/transaction.js';
import { TripAccessService } from './trip-access.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { InvalidTripError, Trip } from './entities/trip.entity.js';
import { TripRepository } from './trip.repository.js';

@Injectable()
export class TripsService {
  constructor(
    private readonly trips: TripRepository,
    private readonly access: TripAccessService,
    private readonly prisma: PrismaService,
    private readonly covers: CoverAssetsService,
    private readonly presenter: CoverPresenter,
  ) {}

  async create(userId: string, dto: CreateTripDto) {
    for (let attempt = 0; ; attempt++) {
      try {
        const input = Trip.validate(dto);
        const result = await serializable(this.prisma, async (tx) => {
          if (dto.clientRequestId) {
            const existing = await this.trips.findByRequestId(
              userId,
              dto.clientRequestId,
              tx,
            );
            if (existing) {
              await this.access.requireTrip(userId, existing.id);
              return existing;
            }
          }
          if (dto.coverAssetId)
            await this.covers.assertAttachable(tx, userId, dto.coverAssetId);
          const trip = await this.trips.create(userId, input, tx);
          return trip;
        });
        return this.presenter.present(result.toJSON());
      } catch (error) {
        if (
          attempt < 4 &&
          dto.clientRequestId &&
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
          continue;
        if (error instanceof InvalidTripError)
          throw new BadRequestException(error.message);
        throw error;
      }
    }
  }

  async findAll(userId: string, query: PaginationQueryDto) {
    const page = await this.trips.findAll(userId, query);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((trip) => this.presenter.present(trip.toJSON())),
      ),
    };
  }

  async findOne(userId: string, id: string) {
    await this.access.requireTrip(userId, id);
    const trip = await this.trips.findById(id);
    if (!trip) throw new NotFoundException('Trip not found');
    return this.presenter.present(trip.toJSON());
  }

  async update(userId: string, id: string, dto: UpdateTripDto) {
    await this.access.requireTrip(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    try {
      const result = await serializable(this.prisma, async (tx) => {
        const trip = await this.trips.findById(id, tx);
        if (!trip) throw new NotFoundException('Trip not found');
        if (dto.coverAssetId)
          await this.covers.assertAttachable(tx, userId, dto.coverAssetId, id);
        const before = JSON.stringify(trip);
        trip.update(dto);
        if (JSON.stringify(trip) === before) return trip;
        const saved = await this.trips.save(trip, tx);
        await notifyMembers(
          tx,
          userId,
          id,
          '旅行が更新されました',
          saved.name,
          { type: 'trip', tripId: id },
        );
        return saved;
      });
      return this.presenter.present(result.toJSON());
    } catch (error) {
      if (error instanceof InvalidTripError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  async members(userId: string, id: string, query: PaginationQueryDto) {
    await this.access.requireTrip(userId, id);
    return this.trips.members(id, query);
  }
}
