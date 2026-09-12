import { buildTemplatePlan, hashPayload } from '../trip-templates/edit-plan.js';
import { applyTemplatePlan } from '../trip-templates/apply-edit-plan.js';
import type { EditTripTemplateDto } from './dto/edit-trip-template.dto.js';
import { ConflictException } from '@nestjs/common';
import { membershipExclusion } from '../trip-templates/identity.js';
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
import { TripTemplatesService } from '../trip-templates/trip-templates.service.js';

@Injectable()
export class TripsService {
  constructor(
    private readonly trips: TripRepository,
    private readonly access: TripAccessService,
    private readonly prisma: PrismaService,
    private readonly covers: CoverAssetsService,
    private readonly presenter: CoverPresenter,
    private readonly templates: TripTemplatesService,
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
          const categories = this.templates.identified(
            {
              locations: input.locations,
              activityPresets: input.activityPresets,
            },
            dto.selectedCategories,
          );
          const excluded = this.templates
            .preview(input)
            .categories.flatMap((category) =>
              category.stamps.flatMap((stamp) =>
                category.key &&
                stamp.key &&
                !categories.some(
                  (selected) =>
                    selected.key === category.key &&
                    selected.stamps.some((item) => item.key === stamp.key),
                )
                  ? [membershipExclusion(category.key, stamp.key)]
                  : [],
              ),
            );
          const trip = await this.trips.create(
            userId,
            input,
            tx,
            categories,
            excluded,
            this.templates.catalog(),
          );
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

  async previewTemplates(userId: string, id: string, dto: EditTripTemplateDto) {
    return serializable(this.prisma, async (tx) => {
      await this.access.requireTrip(userId, id, tx);
      return (await buildTemplatePlan(tx, id, this.templates, dto)).view;
    });
  }

  async update(userId: string, id: string, dto: UpdateTripDto) {
    await this.access.requireTrip(userId, id);
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field is required');
    }
    const payloadHash = hashPayload({
      ...dto,
      templateEdit: dto.templateEdit
        ? {
            clientRequestId: dto.templateEdit.clientRequestId,
            changes: dto.templateEdit.changes,
          }
        : undefined,
    });
    try {
      const result = await serializable(this.prisma, async (tx) => {
        await this.access.requireTrip(userId, id, tx);
        const trip = await this.trips.findById(id, tx);
        if (!trip) throw new NotFoundException('Trip not found');
        if (dto.templateEdit) {
          const receipt = await tx.tripEdit.findUnique({
            where: {
              tripId_clientRequestId: {
                tripId: id,
                clientRequestId: dto.templateEdit.clientRequestId,
              },
            },
          });
          if (receipt) {
            if (receipt.payloadHash !== payloadHash)
              throw new ConflictException(
                'This edit request has already been saved with different input',
              );
            return trip;
          }
        }
        if (dto.coverAssetId)
          await this.covers.assertAttachable(tx, userId, dto.coverAssetId, id);
        const before = JSON.stringify(trip);
        trip.update(dto);
        const syncTemplates =
          !!dto.templateEdit ||
          dto.locations !== undefined ||
          dto.activityPresets !== undefined;
        let templatesChanged = false;
        if (syncTemplates) {
          const plan = await buildTemplatePlan(tx, id, this.templates, {
            locations: trip.locations,
            activityPresets: trip.activityPresets,
            changes: dto.templateEdit?.changes,
          });
          if (
            plan.view.impact.stampCount > 0 &&
            dto.templateEdit?.confirmationToken !== plan.view.confirmationToken
          )
            throw new ConflictException({
              code: 'TEMPLATE_IMPACT_CHANGED',
              message:
                '削除対象が変わりました。投稿数を確認して、もう一度保存してください。',
              preview: plan.view,
            });
          templatesChanged = plan.changed;
          await applyTemplatePlan(tx, plan);
        }
        if (dto.templateEdit)
          await tx.tripEdit.create({
            data: {
              tripId: id,
              clientRequestId: dto.templateEdit.clientRequestId,
              payloadHash,
            },
          });
        if (JSON.stringify(trip) === before && !templatesChanged) return trip;
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
