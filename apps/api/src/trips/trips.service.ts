import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { type PaginationQueryDto } from '../common/pagination.js';
import { serializable } from '../database/transaction.js';
import { TripAccessService } from './trip-access.service.js';
import { InvitationRepository } from '../invitations/invitation.repository.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { InvalidTripError, Trip } from './entities/trip.entity.js';
import { TripRepository } from './trip.repository.js';

@Injectable()
export class TripsService {
  constructor(
    private readonly trips: TripRepository,
    private readonly access: TripAccessService,
    private readonly invitations: InvitationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(userId: string, dto: CreateTripDto): Promise<Trip> {
    try {
      const input = Trip.validate(dto);
      return await serializable(this.prisma, async (tx) => {
        const trip = await this.trips.create(userId, input, tx);
        await this.invitations.createInitial(
          tx,
          trip.id,
          userId,
          dto.inviteeNames ?? [],
        );
        return trip;
      });
    } catch (error) {
      if (error instanceof InvalidTripError)
        throw new BadRequestException(error.message);
      throw error;
    }
  }

  findAll(userId: string, query: PaginationQueryDto) {
    return this.trips.findAll(userId, query);
  }

  async findOne(userId: string, id: string): Promise<Trip> {
    await this.access.requireTrip(userId, id);
    const trip = await this.trips.findById(id);
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async update(userId: string, id: string, dto: UpdateTripDto): Promise<Trip> {
    await this.access.requireTrip(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    try {
      return await serializable(this.prisma, async (tx) => {
        const trip = await this.trips.findById(id, tx);
        if (!trip) throw new NotFoundException('Trip not found');
        trip.update(dto);
        return this.trips.save(trip, tx);
      });
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
