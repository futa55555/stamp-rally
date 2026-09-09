import { createHash } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { CoverPresenter } from '../covers/cover-presenter.service.js';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { TripAccessService } from '../trips/trip-access.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { InvitationRepository } from './invitation.repository.js';

describe('Invitation links and requests integration', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let repository: InvitationRepository;
  let access: TripAccessService;
  let notifications: NotificationsService;
  let sender: string,
    recipient: string,
    other: string,
    outsider: string,
    tripId: string;
  const query = { limit: 20 };
  const countMember = () =>
    prisma.tripMember.count({ where: { tripId, userId: recipient } });
  async function clean() {
    await prisma.notification.deleteMany();
    await prisma.tripInvitation.deleteMany();
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
        TripAccessService,
        NotificationsService,
        CoverPresenter,
        ObjectStorageService,
      ],
    }).compile();
    await moduleRef.init();
    prisma = moduleRef.get(PrismaService);
    repository = moduleRef.get(InvitationRepository);
    access = moduleRef.get(TripAccessService);
    notifications = moduleRef.get(NotificationsService);
  });
  beforeEach(async () => {
    await clean();
    const users = await Promise.all(
      ['Sender', 'Recipient', 'Other', 'Outsider'].map((name) =>
        prisma.user.create({ data: { name, status: 'ACTIVE' } }),
      ),
    );
    [sender, recipient, other, outsider] = users.map((user) => user.id);
    const trip = await prisma.trip.create({
      data: {
        name: 'Trip',
        startDate: new Date('2026-09-07'),
        endDate: new Date('2026-09-08'),
        createdById: sender,
        members: { create: [{ userId: sender }, { userId: other }] },
      },
    });
    tripId = trip.id;
  });
  afterAll(async () => {
    await clean();
    await moduleRef.close();
  });
  async function apply() {
    const link = await repository.createLink(tripId, sender);
    return {
      link,
      invitation: await repository.request(link.token, recipient),
    };
  }
  it('remembers a received link once and lets only its recipient apply from the notification', async () => {
    const link = await repository.createLink(tripId, sender);
    await expect(
      repository.previewReceived(link.id, recipient),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.requestReceived(link.id, recipient),
    ).rejects.toBeInstanceOf(NotFoundException);
    const previews = await Promise.all(
      Array.from({ length: 3 }, () =>
        repository.preview(link.token, recipient),
      ),
    );
    expect(previews[0]).toMatchObject({
      canRequest: true,
      invitation: null,
      linkStatus: 'ACTIVE',
    });
    expect(JSON.stringify(previews)).not.toContain(link.token);
    expect(JSON.stringify(previews)).not.toContain('tokenHash');
    expect(await prisma.tripInvitation.count()).toBe(0);
    expect(await countMember()).toBe(0);
    const inbox = await notifications.list(recipient, query);
    expect(inbox.unreadCount).toBe(1);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]).toMatchObject({
      title: '旅行への招待が届きました',
      target: { type: 'invitation-link', linkId: link.id },
    });
    expect((await notifications.list(sender, query)).items).toHaveLength(0);
    expect((await notifications.list(other, query)).items).toHaveLength(0);
    await expect(access.requireTrip(recipient, tripId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      repository.previewReceived(link.id, outsider),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.requestReceived(link.id, outsider),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      notifications.markRead(outsider, inbox.items[0].id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await notifications.markRead(recipient, inbox.items[0].id);
    await repository.preview(link.token, recipient);
    expect((await notifications.list(recipient, query)).unreadCount).toBe(0);
    expect(
      (await repository.previewReceived(link.id, recipient)).canRequest,
    ).toBe(true);
    const invitation = await repository.requestReceived(link.id, recipient);
    expect(invitation.status).toBe('PENDING_CONFIRMATION');
    expect(await countMember()).toBe(0);
    for (const member of [sender, other]) {
      const requests = await notifications.list(member, query);
      expect(requests.unreadCount).toBe(1);
      expect(requests.items[0]).toMatchObject({
        title: '参加申請が届きました',
        target: { type: 'invitation', invitationId: invitation.id },
      });
    }
    expect(
      (await repository.previewReceived(link.id, recipient)).invitation?.id,
    ).toBe(invitation.id);
    await repository.decide(
      invitation.id,
      sender,
      'confirm',
      invitation.generation,
    );
    expect(await countMember()).toBe(1);
    expect((await notifications.list(recipient, query)).items[0].title).toBe(
      '参加が確定しました',
    );
  });
  it('marks received invitations read on application and does not notify existing members about their own links', async () => {
    const link = await repository.createLink(tripId, sender);
    await repository.preview(link.token, sender);
    await repository.preview(link.token, other);
    expect(await prisma.notification.count()).toBe(0);
    await repository.preview(link.token, recipient);
    await repository.request(link.token, recipient);
    const inbox = await notifications.list(recipient, query);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.unreadCount).toBe(0);
    await repository.preview(link.token, recipient);
    expect((await notifications.list(recipient, query)).items).toHaveLength(1);
  });
  it.each(['EXPIRED', 'REVOKED'] as const)(
    'withholds trip data for an unrequested received %s link and prevents applications',
    async (linkStatus) => {
      const link = await repository.createLink(tripId, sender);
      await repository.preview(link.token, recipient);
      if (linkStatus === 'REVOKED')
        await repository.revokeLink(link.id, sender);
      else
        await prisma.invitationLink.update({
          where: { id: link.id },
          data: { expiresAt: new Date(0) },
        });
      await expect(
        repository.previewReceived(link.id, recipient),
      ).rejects.toBeInstanceOf(GoneException);
      await expect(
        repository.requestReceived(link.id, recipient),
      ).rejects.toBeInstanceOf(GoneException);
      expect(await prisma.tripInvitation.count()).toBe(0);
      expect((await notifications.list(recipient, query)).items).toHaveLength(
        1,
      );
    },
  );
  describe.each(['ACTIVE', 'EXPIRED', 'REVOKED'] as const)(
    'resolving a %s link',
    (linkStatus) => {
      it.each([
        'NONE',
        'PENDING_CONFIRMATION',
        'ACCEPTED',
        'DECLINED',
        'CANCELLED',
      ] as const)('prioritizes the applicant state %s', async (state) => {
        const link = await repository.createLink(tripId, sender);
        await repository.preview(link.token, recipient);
        if (state !== 'NONE') {
          const application = await repository.request(link.token, recipient);
          if (state !== 'PENDING_CONFIRMATION')
            await repository.decide(
              application.id,
              state === 'DECLINED' ? recipient : sender,
              state === 'ACCEPTED'
                ? 'confirm'
                : state === 'DECLINED'
                  ? 'decline'
                  : 'cancel',
              1,
            );
        }
        if (linkStatus === 'EXPIRED')
          await prisma.invitationLink.update({
            where: { id: link.id },
            data: { expiresAt: new Date(0) },
          });
        if (linkStatus === 'REVOKED')
          await repository.revokeLink(link.id, sender);
        const before = await prisma.notification.count();
        const visible =
          linkStatus === 'ACTIVE' ||
          state === 'ACCEPTED' ||
          state === 'PENDING_CONFIRMATION';
        for (const resolve of [
          () => repository.preview(link.token, recipient),
          () => repository.previewReceived(link.id, recipient),
        ]) {
          if (visible)
            expect(await resolve()).toMatchObject({
              linkStatus,
              isMember: state === 'ACCEPTED',
              canRequest: state === 'NONE' && linkStatus === 'ACTIVE',
              invitation:
                state === 'NONE'
                  ? null
                  : expect.objectContaining({ status: state }),
            });
          else await expect(resolve()).rejects.toBeInstanceOf(GoneException);
        }
        expect(await prisma.notification.count()).toBe(before);
        expect((await repository.preview(link.token, sender)).isMember).toBe(
          true,
        );
        if (linkStatus !== 'ACTIVE')
          await expect(
            repository.request(link.token, recipient),
          ).rejects.toBeInstanceOf(GoneException);
      });
    },
  );
  it('checks public status without adding notifications or applications', async () => {
    const link = await repository.createLink(tripId, sender);
    expect(await repository.publicStatus(link.token)).toEqual({
      status: 'ACTIVE',
    });
    expect(await repository.publicStatus('a'.repeat(43))).toEqual({
      status: 'NOT_FOUND',
    });
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.tripInvitation.count()).toBe(0);
    expect(await countMember()).toBe(0);
  });
  it('preserves an application across a different expired link and permits reapplication only with a new active link', async () => {
    const { link, invitation } = await apply();
    const next = await repository.createLink(tripId, other);
    await repository.revokeLink(next.id, other);
    expect(
      (await repository.preview(next.token, recipient)).invitation?.id,
    ).toBe(invitation.id);
    await repository.decide(invitation.id, recipient, 'decline', 1);
    const fresh = await repository.createLink(tripId, other);
    expect((await repository.preview(link.token, recipient)).canRequest).toBe(
      false,
    );
    expect((await repository.preview(fresh.token, recipient)).canRequest).toBe(
      true,
    );
    await expect(
      repository.preview(next.token, recipient),
    ).rejects.toBeInstanceOf(GoneException);
  });
  it('shares one link with multiple users and grants access only after any member confirms', async () => {
    const { link, invitation } = await apply();
    expect(link.token).toHaveLength(43);
    expect(link).not.toHaveProperty('tokenHash');
    const stored = await prisma.invitationLink.findUniqueOrThrow({
      where: { id: link.id },
    });
    expect(stored.tokenHash).toBe(
      createHash('sha256').update(link.token).digest('hex'),
    );
    expect(
      stored.expiresAt.getTime() - stored.createdAt.getTime(),
    ).toBeGreaterThan(604790000);
    expect(await countMember()).toBe(0);
    await expect(access.requireTrip(recipient, tripId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(invitation.status).toBe('PENDING_CONFIRMATION');
    expect(invitation.trip).not.toHaveProperty('members');
    const second = await repository.request(link.token, outsider);
    expect(second.id).not.toBe(invitation.id);
    expect(
      (await repository.listReceived(other, { ...query, view: 'review' }))
        .items,
    ).toHaveLength(2);
    await prisma.user.update({
      where: { id: recipient },
      data: { name: 'Renamed' },
    });
    const confirmed = await repository.decide(
      invitation.id,
      other,
      'confirm',
      invitation.generation,
    );
    expect(confirmed.status).toBe('ACCEPTED');
    expect(await countMember()).toBe(1);
    await expect(
      access.requireTrip(recipient, tripId),
    ).resolves.toBeUndefined();
    expect(
      (await repository.detail(invitation.id, recipient)).invitee.name,
    ).toBe('Renamed');
  });
  it('requires membership for links and restricts cancellation and self-confirmation', async () => {
    await expect(
      repository.createLink(tripId, outsider),
    ).rejects.toBeInstanceOf(NotFoundException);
    const { link, invitation } = await apply();
    await expect(repository.revokeLink(link.id, other)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    for (const [actor, action] of [
      [recipient, 'confirm'],
      [other, 'cancel'],
      [outsider, 'confirm'],
    ] as const)
      await expect(
        repository.decide(invitation.id, actor, action, 1),
      ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      repository.detail(invitation.id, outsider),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(repository.request(link.token, sender)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await repository.decide(invitation.id, sender, 'cancel', 1);
    expect((await notifications.list(recipient, query)).items[0].title).toBe(
      '参加申請が取り消されました',
    );
    expect(await countMember()).toBe(0);
  });
  it('rejects expired and revoked links without ending existing requests', async () => {
    const { link, invitation } = await apply();
    await repository.revokeLink(link.id, sender);
    await expect(
      repository.request(link.token, outsider),
    ).rejects.toBeInstanceOf(GoneException);
    await repository.decide(invitation.id, other, 'confirm', 1);
    const expired = await repository.createLink(tripId, sender);
    await prisma.invitationLink.update({
      where: { id: expired.id },
      data: { expiresAt: new Date(Date.now() - 1) },
    });
    await expect(
      repository.preview(expired.token, outsider),
    ).rejects.toBeInstanceOf(GoneException);
    await expect(
      repository.request('a'.repeat(43), outsider),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(await countMember()).toBe(1);
  });
  it('deduplicates concurrent requests and confirmations, including notifications', async () => {
    const link = await repository.createLink(tripId, sender);
    const results = await Promise.all(
      Array.from({ length: 3 }, () =>
        repository.request(link.token, recipient),
      ),
    );
    expect(new Set(results.map((row) => row.id)).size).toBe(1);
    expect(await prisma.notification.count()).toBe(2);
    const id = results[0].id;
    await Promise.all(
      [sender, other, sender].map((actor) =>
        repository.decide(id, actor, 'confirm', 1),
      ),
    );
    expect(await countMember()).toBe(1);
    expect(await prisma.notification.count()).toBe(4);
  });
  it.each(['decline', 'cancel'] as const)(
    'resolves confirm/%s races to one terminal state',
    async (action) => {
      const { invitation } = await apply();
      const results = await Promise.allSettled([
        repository.decide(invitation.id, other, 'confirm', 1),
        repository.decide(
          invitation.id,
          action === 'decline' ? recipient : sender,
          action,
          1,
        ),
      ]);
      expect(
        results.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const stored = await prisma.tripInvitation.findUniqueOrThrow({
        where: { id: invitation.id },
      });
      expect(await countMember()).toBe(stored.status === 'ACCEPTED' ? 1 : 0);
    },
  );
  it('requires a new link to reapply and fences stale generations', async () => {
    const { link, invitation } = await apply();
    await repository.decide(invitation.id, recipient, 'decline', 1);
    await repository.decide(invitation.id, recipient, 'decline', 1);
    await expect(
      repository.request(link.token, recipient),
    ).rejects.toBeInstanceOf(ConflictException);
    const nextLink = await repository.createLink(tripId, other);
    const next = await repository.request(nextLink.token, recipient);
    expect(next).toMatchObject({
      id: invitation.id,
      generation: 2,
      invitedById: other,
    });
    await expect(
      repository.decide(next.id, sender, 'confirm', 1),
    ).rejects.toBeInstanceOf(ConflictException);
    await repository.decide(next.id, other, 'confirm', 2);
  });
  it('allows own invitation notifications before membership, preserving normal notification privacy', async () => {
    const { invitation } = await apply();
    expect((await notifications.list(sender, query)).unreadCount).toBe(1);
    await repository.decide(invitation.id, sender, 'cancel', 1);
    const result = await notifications.list(recipient, query);
    expect(result.unreadCount).toBe(1);
    const notification = result.items[0];
    const first = await notifications.markRead(recipient, notification.id);
    expect(
      (await notifications.markRead(recipient, notification.id)).readAt,
    ).toEqual(first.readAt);
    await expect(
      notifications.markRead(outsider, notification.id),
    ).rejects.toBeInstanceOf(NotFoundException);
    await prisma.notification.create({
      data: {
        recipientId: recipient,
        tripId,
        title: 'Private',
        body: 'Private',
        target: { type: 'trip', tripId },
      },
    });
    expect((await notifications.list(recipient, query)).items).toHaveLength(1);
  });
  it('paginates reviewer notifications and requests without leaking another trip', async () => {
    const { invitation } = await apply();
    const link = await repository.createLink(tripId, sender);
    await repository.request(link.token, outsider);
    const first = await repository.listReceived(other, {
      limit: 1,
      view: 'review',
    });
    const second = await repository.listReceived(other, {
      limit: 1,
      cursor: first.nextCursor!,
      view: 'review',
    });
    expect(first.items[0].id).not.toBe(second.items[0].id);
    const n1 = await notifications.list(sender, { limit: 1 });
    const n2 = await notifications.list(sender, {
      limit: 1,
      cursor: n1.nextCursor!,
    });
    expect(n1.items[0].id).not.toBe(n2.items[0].id);
    expect(
      (await repository.detail(invitation.id, recipient)).allowedActions,
    ).toEqual(['decline']);
  });
});
