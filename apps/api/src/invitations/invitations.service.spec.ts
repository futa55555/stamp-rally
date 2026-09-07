import { ConflictException, NotFoundException } from '@nestjs/common';
import { TripAccessService } from '../trips/trip-access.service.js';
import { PaginationQueryDto } from '../common/pagination.js';
import {
  InvitationConflictError,
  InvitationNotFoundError,
} from './entities/invitation.entity.js';
import { InvitationRepository } from './invitation.repository.js';
import { InvitationsService } from './invitations.service.js';

describe('InvitationsService', () => {
  const repository = {
    create: vi.fn(),
    listForTrip: vi.fn(),
    listReceived: vi.fn(),
    decide: vi.fn(),
  };
  const access = { requireTrip: vi.fn() };
  const service = new InvitationsService(
    repository as unknown as InvitationRepository,
    access as unknown as TripAccessService,
  );

  beforeEach(() => vi.resetAllMocks());

  it('checks trip access before looking up the invitee', async () => {
    access.requireTrip.mockRejectedValue(new NotFoundException());

    await expect(
      service.create('outsider', 'trip', { inviteeName: 'Target' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('checks trip access before listing invitations', async () => {
    access.requireTrip.mockRejectedValue(new NotFoundException());

    await expect(
      service.listForTrip('outsider', 'trip', new PaginationQueryDto()),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.listForTrip).not.toHaveBeenCalled();
  });

  it('maps invitation conflicts to HTTP 409', async () => {
    repository.create.mockRejectedValue(
      new InvitationConflictError('User is already a trip member'),
    );

    await expect(
      service.create('member', 'trip', { inviteeName: 'Target' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(access.requireTrip).toHaveBeenCalledWith('member', 'trip');
  });

  it('maps missing or inaccessible invitations to HTTP 404', async () => {
    repository.decide.mockRejectedValue(
      new InvitationNotFoundError('Invitation not found'),
    );

    await expect(
      service.decide('outsider', 'invite', 'ACCEPTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.decide).toHaveBeenCalledWith(
      'invite',
      'outsider',
      'ACCEPTED',
    );
  });

  it('only lists invitations addressed to the authenticated user', async () => {
    const query = new PaginationQueryDto();
    repository.listReceived.mockResolvedValue({ items: [], nextCursor: null });

    await expect(service.listReceived('recipient', query)).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
    expect(repository.listReceived).toHaveBeenCalledWith('recipient', query);
  });
});
