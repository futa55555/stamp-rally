import type { InvitationStatus } from '../../generated/prisma/enums.js';

export class InvitationConflictError extends Error {}
export class InvitationNotFoundError extends Error {}

export function assertCanInvite(
  inviterId: string,
  inviteeId: string,
  isMember: boolean,
): void {
  if (inviterId === inviteeId) {
    throw new InvitationConflictError('You cannot invite yourself');
  }
  if (isMember) {
    throw new InvitationConflictError('User is already a trip member');
  }
}

export function decideInvitation(
  current: InvitationStatus,
  decision: 'ACCEPTED' | 'DECLINED',
): InvitationStatus {
  if (current !== 'PENDING' && current !== decision) {
    throw new InvitationConflictError(
      'This invitation has already been answered',
    );
  }
  return decision;
}
