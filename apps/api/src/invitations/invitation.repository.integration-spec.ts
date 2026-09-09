import { CoverPresenter } from '../covers/cover-presenter.service.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service.js';
import { PaginationQueryDto } from '../common/pagination.js';
import { serializable } from '../database/transaction.js';
import {
  InvitationConflictError,
  InvitationNotFoundError,
} from './entities/invitation.entity.js';
import { InvitationRepository } from './invitation.repository.js';

describe('InvitationRepository integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: InvitationRepository;
  let inviterId: string;
  let recipientId: string;
  let outsiderId: string;
  let tripId: string;

  async function cleanDatabase() {
    await prisma.trip.deleteMany();
    await prisma.session.deleteMany();
    await prisma.authAccount.deleteMany();
    await prisma.user.deleteMany();
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ envFilePath: '.env.test' })],
      providers: [
        PrismaService,
        InvitationRepository,
        CoverPresenter,
        ObjectStorageService,
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(InvitationRepository);
  });

  beforeEach(async () => {
    await cleanDatabase();
    const inviter = await prisma.user.create({
      data: { name: 'Inviter', status: 'ACTIVE' },
    });
    const recipient = await prisma.user.create({
      data: { name: 'Recipient', status: 'ACTIVE' },
    });
    const outsider = await prisma.user.create({
      data: { name: 'Outsider', status: 'ACTIVE' },
    });
    inviterId = inviter.id;
    recipientId = recipient.id;
    outsiderId = outsider.id;
    const trip = await prisma.trip.create({
      data: {
        name: 'Trip',
        startDate: new Date('2026-09-07T00:00:00Z'),
        endDate: new Date('2026-09-08T00:00:00Z'),
        createdById: inviterId,
        members: { create: { userId: inviterId } },
      },
    });
    tripId = trip.id;
  });

  afterAll(async () => {
    await cleanDatabase();
    await moduleRef.close();
  });

  it('creates a stable invitation and accepts it after the recipient changes name', async () => {
    const invitation = await repository.create(
      tripId,
      inviterId,
      '  Recipient  ',
    );
    expect(invitation.trip.startDate).toBe('2026-09-07');
    expect(invitation.invitee).toEqual({ id: recipientId, name: 'Recipient' });
    expect(invitation.invitedBy).toEqual({ id: inviterId, name: 'Inviter' });
    expect(await prisma.tripMember.count({ where: { tripId } })).toBe(1);

    await prisma.user.update({
      where: { id: recipientId },
      data: { name: 'Renamed' },
    });
    const received = await repository.listReceived(
      recipientId,
      new PaginationQueryDto(),
    );
    expect(received.items.map((item) => item.id)).toEqual([invitation.id]);

    const accepted = await repository.decide(
      invitation.id,
      recipientId,
      'ACCEPTED',
    );
    expect(accepted.status).toBe('ACCEPTED');
    expect(accepted.invitee).toEqual({ id: recipientId, name: 'Renamed' });
    expect(
      await prisma.tripMember.count({ where: { tripId, userId: recipientId } }),
    ).toBe(1);
    expect(
      (await repository.listReceived(recipientId, new PaginationQueryDto()))
        .items,
    ).toEqual([]);
    expect(
      (await repository.listForTrip(tripId, new PaginationQueryDto())).items[0]
        .status,
    ).toBe('ACCEPTED');
  });

  it('returns the same pending invitation under concurrent issuance', async () => {
    const invitations = await Promise.all(
      Array.from({ length: 3 }, () =>
        repository.create(tripId, inviterId, 'Recipient'),
      ),
    );

    expect(new Set(invitations.map((item) => item.id)).size).toBe(1);
    expect(
      await prisma.tripInvitation.count({
        where: { tripId, inviteeId: recipientId },
      }),
    ).toBe(1);
  });

  it('accepts concurrently and repeatedly without duplicate members', async () => {
    const invitation = await repository.create(tripId, inviterId, 'Recipient');
    const responses = await Promise.all(
      Array.from({ length: 3 }, () =>
        repository.decide(invitation.id, recipientId, 'ACCEPTED'),
      ),
    );

    expect(responses.every((item) => item.status === 'ACCEPTED')).toBe(true);
    expect(
      await prisma.tripMember.count({ where: { tripId, userId: recipientId } }),
    ).toBe(1);
    await expect(
      repository.decide(invitation.id, recipientId, 'ACCEPTED'),
    ).resolves.toMatchObject({ status: 'ACCEPTED' });
  });

  it('allows only one outcome when accept and decline race', async () => {
    const invitation = await repository.create(tripId, inviterId, 'Recipient');
    const results = await Promise.allSettled([
      repository.decide(invitation.id, recipientId, 'ACCEPTED'),
      repository.decide(invitation.id, recipientId, 'DECLINED'),
    ]);

    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const failed = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(InvitationConflictError);
    const persisted = await prisma.tripInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    expect(
      await prisma.tripMember.count({ where: { tripId, userId: recipientId } }),
    ).toBe(persisted.status === 'ACCEPTED' ? 1 : 0);
  });

  it('keeps decisions recipient-only and hides other users pending invitations', async () => {
    const invitation = await repository.create(tripId, inviterId, 'Recipient');

    await expect(
      repository.decide(invitation.id, outsiderId, 'ACCEPTED'),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    await expect(
      repository.decide(invitation.id, inviterId, 'DECLINED'),
    ).rejects.toBeInstanceOf(InvitationNotFoundError);
    expect(
      (await repository.listReceived(outsiderId, new PaginationQueryDto()))
        .items,
    ).toEqual([]);
    expect(await prisma.tripMember.count({ where: { tripId } })).toBe(1);
  });

  it('supports re-invitation after a decline but rejects changing an answered decision', async () => {
    const invitation = await repository.create(tripId, inviterId, 'Recipient');
    await repository.decide(invitation.id, recipientId, 'DECLINED');
    await expect(
      repository.decide(invitation.id, recipientId, 'DECLINED'),
    ).resolves.toMatchObject({ status: 'DECLINED' });
    await expect(
      repository.decide(invitation.id, recipientId, 'ACCEPTED'),
    ).rejects.toBeInstanceOf(InvitationConflictError);

    await expect(
      repository.create(tripId, inviterId, 'Recipient'),
    ).resolves.toMatchObject({ id: invitation.id, status: 'PENDING' });
    await repository.decide(invitation.id, recipientId, 'ACCEPTED');
    await expect(
      repository.create(tripId, inviterId, 'Recipient'),
    ).rejects.toBeInstanceOf(InvitationConflictError);
  });

  it('rejects self, member, unknown, differently cased and onboarding invitees', async () => {
    await prisma.user.create({ data: { name: 'Onboarding' } });
    await expect(
      repository.create(tripId, inviterId, 'Inviter'),
    ).rejects.toBeInstanceOf(InvitationConflictError);
    for (const name of ['Missing', 'recipient', 'Onboarding']) {
      await expect(
        repository.create(tripId, inviterId, name),
      ).rejects.toBeInstanceOf(InvitationNotFoundError);
    }
    expect(await prisma.tripInvitation.count()).toBe(0);
  });

  it('creates initial invitations together and deduplicates trimmed names', async () => {
    await serializable(prisma, (tx) =>
      repository.createInitial(tx, tripId, inviterId, [
        'Recipient',
        ' Recipient ',
        'Outsider',
      ]),
    );
    expect(await prisma.tripInvitation.count({ where: { tripId } })).toBe(2);
  });

  it('rejects and rolls back invalid initial invitation sets', async () => {
    await expect(
      serializable(prisma, (tx) =>
        repository.createInitial(tx, tripId, inviterId, [
          'Recipient',
          'Missing',
        ]),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      serializable(prisma, (tx) =>
        repository.createInitial(tx, tripId, inviterId, [
          'Recipient',
          'Inviter',
        ]),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await prisma.tripInvitation.count({ where: { tripId } })).toBe(0);
  });

  it('paginates invitations consistently when creation timestamps tie', async () => {
    await repository.create(tripId, inviterId, 'Recipient');
    await repository.create(tripId, inviterId, 'Outsider');
    await prisma.tripInvitation.updateMany({
      where: { tripId },
      data: { createdAt: new Date('2026-09-07T00:00:00Z') },
    });

    const first = await repository.listForTrip(tripId, { limit: 1 });
    const second = await repository.listForTrip(tripId, {
      limit: 1,
      cursor: first.nextCursor!,
    });

    expect(first.items).toHaveLength(1);
    expect(second.items).toHaveLength(1);
    expect(first.items[0].id).not.toBe(second.items[0].id);
    expect(second.nextCursor).toBeNull();
  });
});
