import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoverPresenter } from '../covers/cover-presenter.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  paginate,
  paginationOrder,
  paginationWhere,
  type PaginationQueryDto,
} from '../common/pagination.js';
import { serializable } from '../database/transaction.js';
import {
  allowedActions,
  decisionStatus,
  type InvitationAction,
} from './entities/invitation.entity.js';

const tripSelect = {
  id: true,
  name: true,
  startDate: true,
  endDate: true,
  coverImageUrl: true,
  coverAssetId: true,
  members: { select: { userId: true } },
} satisfies Prisma.TripSelect;
const invitationInclude = {
  trip: { select: tripSelect },
  invitee: { select: { id: true, name: true } },
  invitedBy: { select: { id: true, name: true } },
} satisfies Prisma.TripInvitationInclude;
const linkInclude = {
  trip: { select: tripSelect },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.InvitationLinkInclude;
type Invitation = Prisma.TripInvitationGetPayload<{
  include: typeof invitationInclude;
}>;
type Link = Prisma.InvitationLinkGetPayload<{ include: typeof linkInclude }>;
const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');

@Injectable()
export class InvitationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly covers: CoverPresenter,
  ) {}

  private async tripSummary(trip: Invitation['trip']) {
    const { members: _members, ...summary } = trip;
    return this.covers.present({
      ...summary,
      startDate: trip.startDate.toISOString().slice(0, 10),
      endDate: trip.endDate.toISOString().slice(0, 10),
    });
  }

  private async present(invitation: Invitation, userId: string) {
    const isMember = invitation.trip.members.some(
      (member) => member.userId === userId,
    );
    return {
      ...invitation,
      trip: await this.tripSummary(invitation.trip),
      allowedActions: allowedActions(invitation, userId, isMember),
    };
  }

  private async requireMember(
    tx: Prisma.TransactionClient,
    tripId: string,
    userId: string,
  ) {
    if (
      !(await tx.tripMember.findUnique({
        where: { tripId_userId: { tripId, userId } },
      }))
    )
      throw new NotFoundException('旅行が見つかりません。');
  }

  async createLink(tripId: string, userId: string) {
    const token = randomBytes(32).toString('base64url');
    return this.write(async (tx) => {
      await this.requireMember(tx, tripId, userId);
      const link = await tx.invitationLink.create({
        data: {
          tripId,
          createdById: userId,
          tokenHash: tokenHash(token),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });
      const { tokenHash: _hash, ...publicLink } = link;
      return { ...publicLink, token };
    });
  }

  async listLinks(tripId: string, userId: string, query: PaginationQueryDto) {
    await this.requireMember(this.prisma, tripId, userId);
    const rows = await this.prisma.invitationLink.findMany({
      where: { tripId, ...paginationWhere(query, 'desc') },
      select: {
        id: true,
        tripId: true,
        createdById: true,
        expiresAt: true,
        revokedAt: true,
        createdAt: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    return paginate(rows, query.limit);
  }

  async revokeLink(id: string, userId: string) {
    return this.write(async (tx) => {
      const link = await tx.invitationLink.findFirst({
        where: { id, createdById: userId },
      });
      if (!link) throw new NotFoundException('招待リンクが見つかりません。');
      await this.requireMember(tx, link.tripId, userId);
      const updated = link.revokedAt
        ? link
        : await tx.invitationLink.update({
            where: { id },
            data: { revokedAt: new Date() },
          });
      const { tokenHash: _hash, ...result } = updated;
      return result;
    });
  }

  private async validLink(tx: Prisma.TransactionClient, token: string) {
    const link = await tx.invitationLink.findUnique({
      where: { tokenHash: tokenHash(token) },
      include: linkInclude,
    });
    if (!link) throw new NotFoundException('招待リンクが見つかりません。');
    this.requireActiveLink(link);
    return link;
  }

  private requireActiveLink(link: Link) {
    if (link.revokedAt || link.expiresAt.getTime() <= Date.now())
      throw new GoneException(
        'この招待リンクは期限切れ、または無効化されています。',
      );
  }

  async preview(token: string, userId: string) {
    return this.write(async (tx) => {
      const link = await this.validLink(tx, token);
      const preview = await this.presentLink(tx, link, userId);
      // Remember receipt without applying or notifying the trip's members.
      if (preview.canRequest)
        await tx.notification.upsert({
          where: {
            recipientId_invitationLinkId: {
              recipientId: userId,
              invitationLinkId: link.id,
            },
          },
          create: {
            recipientId: userId,
            tripId: link.tripId,
            invitationLinkId: link.id,
            title: '旅行への招待が届きました',
            body:
              link.createdBy.name +
              'さんから「' +
              link.trip.name +
              '」への招待です。',
            target: { type: 'invitation-link', linkId: link.id },
          },
          update: {},
        });
      return preview;
    });
  }

  private async receivedLink(
    tx: Prisma.TransactionClient,
    id: string,
    userId: string,
  ) {
    const link = await tx.invitationLink.findFirst({
      where: { id, notifications: { some: { recipientId: userId } } },
      include: linkInclude,
    });
    if (!link) throw new NotFoundException('招待が見つかりません。');
    return link;
  }

  async previewReceived(id: string, userId: string) {
    const link = await this.receivedLink(this.prisma, id, userId);
    return this.presentLink(this.prisma, link, userId);
  }

  private async presentLink(
    tx: Prisma.TransactionClient,
    link: Link,
    userId: string,
  ) {
    const existing = await tx.tripInvitation.findUnique({
      where: { tripId_inviteeId: { tripId: link.tripId, inviteeId: userId } },
      include: invitationInclude,
    });
    const linkStatus = link.revokedAt
      ? 'REVOKED'
      : link.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : 'ACTIVE';
    return {
      id: link.id,
      trip: await this.tripSummary(link.trip),
      createdBy: link.createdBy,
      expiresAt: link.expiresAt,
      linkStatus,
      isMember: link.trip.members.some((member) => member.userId === userId),
      invitation: existing ? await this.present(existing, userId) : null,
      canRequest:
        linkStatus === 'ACTIVE' &&
        !link.trip.members.some((member) => member.userId === userId) &&
        (!existing ||
          (existing.status !== 'PENDING_CONFIRMATION' &&
            existing.linkId !== link.id)),
    };
  }

  async request(token: string, userId: string) {
    return this.write(async (tx) => {
      const link = await this.validLink(tx, token);
      return this.requestWithLink(tx, link, userId);
    });
  }

  async requestReceived(id: string, userId: string) {
    return this.write(async (tx) => {
      const link = await this.receivedLink(tx, id, userId);
      this.requireActiveLink(link);
      return this.requestWithLink(tx, link, userId);
    });
  }

  private async requestWithLink(
    tx: Prisma.TransactionClient,
    link: Link,
    userId: string,
  ) {
    const where = {
      tripId_inviteeId: { tripId: link.tripId, inviteeId: userId },
    };
    const existing = await tx.tripInvitation.findUnique({
      where,
      include: invitationInclude,
    });
    if (
      existing?.status === 'PENDING_CONFIRMATION' ||
      existing?.status === 'ACCEPTED'
    )
      return this.present(existing, userId);
    if (link.trip.members.some((member) => member.userId === userId))
      throw new ConflictException('すでにこの旅行に参加しています。');
    if (existing?.linkId === link.id)
      throw new ConflictException('再申請には新しい招待リンクが必要です。');
    const data = {
      invitedById: link.createdById,
      linkId: link.id,
      status: 'PENDING_CONFIRMATION' as const,
    };
    const invitation = existing
      ? await tx.tripInvitation.update({
          where,
          data: { ...data, generation: { increment: 1 } },
          include: invitationInclude,
        })
      : await tx.tripInvitation.create({
          data: { ...data, tripId: link.tripId, inviteeId: userId },
          include: invitationInclude,
        });
    await this.notify(
      tx,
      invitation,
      userId,
      '参加申請が届きました',
      invitation.invitee.name + 'さんが参加を希望しています。',
    );
    return this.present(invitation, userId);
  }

  async listForTrip(tripId: string, userId: string, query: PaginationQueryDto) {
    await this.requireMember(this.prisma, tripId, userId);
    return this.list({ tripId }, userId, query);
  }

  async listReceived(
    userId: string,
    query: PaginationQueryDto & { view?: 'mine' | 'review' },
  ) {
    return this.list(
      query.view === 'review'
        ? {
            status: 'PENDING_CONFIRMATION',
            trip: { members: { some: { userId } } },
          }
        : { inviteeId: userId },
      userId,
      query,
    );
  }

  async detail(id: string, userId: string) {
    const invitation = await this.prisma.tripInvitation.findFirst({
      where: {
        id,
        OR: [
          { inviteeId: userId },
          { trip: { members: { some: { userId } } } },
        ],
      },
      include: invitationInclude,
    });
    if (!invitation) throw new NotFoundException('参加申請が見つかりません。');
    return this.present(invitation, userId);
  }

  async decide(
    id: string,
    userId: string,
    action: InvitationAction,
    generation: number,
  ) {
    return this.write(async (tx) => {
      const invitation = await tx.tripInvitation.findUnique({
        where: { id },
        include: invitationInclude,
      });
      const isMember =
        invitation?.trip.members.some((member) => member.userId === userId) ??
        false;
      const authorized =
        invitation &&
        (action === 'decline'
          ? invitation.inviteeId === userId
          : isMember &&
            invitation.inviteeId !== userId &&
            (action === 'confirm' || invitation.invitedById === userId));
      if (!invitation || !authorized)
        throw new NotFoundException('参加申請が見つかりません。');
      if (invitation.generation !== generation)
        throw new ConflictException(
          '申請が更新されています。再読み込みしてください。',
        );
      const status = decisionStatus[action];
      if (invitation.status === status) return this.present(invitation, userId);
      if (invitation.status !== 'PENDING_CONFIRMATION')
        throw new ConflictException('この参加申請はすでに終了しています。');
      if (action === 'confirm')
        await tx.tripMember.upsert({
          where: {
            tripId_userId: {
              tripId: invitation.tripId,
              userId: invitation.inviteeId,
            },
          },
          create: { tripId: invitation.tripId, userId: invitation.inviteeId },
          update: {},
        });
      const updated = await tx.tripInvitation.update({
        where: { id },
        data: { status },
        include: invitationInclude,
      });
      const title =
        action === 'confirm'
          ? '参加が確定しました'
          : action === 'decline'
            ? '参加申請が撤回されました'
            : '参加申請が取り消されました';
      await this.notify(
        tx,
        updated,
        userId,
        title,
        updated.invitee.name + 'さん・' + updated.trip.name,
      );
      return this.present(updated, userId);
    });
  }

  private async notify(
    tx: Prisma.TransactionClient,
    invitation: Invitation,
    actorId: string,
    title: string,
    body: string,
  ) {
    await tx.notification.updateMany({
      where: {
        readAt: null,
        OR: [
          { invitationId: invitation.id },
          {
            tripId: invitation.tripId,
            recipientId: invitation.inviteeId,
            invitationLinkId: { not: null },
          },
        ],
      },
      data: { readAt: new Date() },
    });
    const recipients = [
      ...new Set([
        ...invitation.trip.members.map((member) => member.userId),
        invitation.inviteeId,
      ]),
    ].filter((id) => id !== actorId);
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((recipientId) => ({
          recipientId,
          tripId: invitation.tripId,
          invitationId: invitation.id,
          title,
          body,
          target: { type: 'invitation', invitationId: invitation.id },
        })),
      });
  }

  private async list(
    where: Prisma.TripInvitationWhereInput,
    userId: string,
    query: PaginationQueryDto,
  ) {
    const rows = await this.prisma.tripInvitation.findMany({
      where: { AND: [where, paginationWhere(query, 'desc')] },
      include: invitationInclude,
      orderBy: paginationOrder('desc'),
      take: query.limit + 1,
    });
    const page = paginate(rows, query.limit);
    return {
      ...page,
      items: await Promise.all(
        page.items.map((row) => this.present(row, userId)),
      ),
    };
  }

  private async write<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await serializable(this.prisma, work);
      } catch (error) {
        if (
          attempt >= 4 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== 'P2002'
        )
          throw error;
      }
    }
  }
}
