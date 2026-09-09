import type { InvitationStatus } from '../../generated/prisma/enums.js';

export type InvitationAction = 'confirm' | 'decline' | 'cancel';
export const decisionStatus = {
  confirm: 'ACCEPTED',
  decline: 'DECLINED',
  cancel: 'CANCELLED',
} as const satisfies Record<InvitationAction, InvitationStatus>;

export function allowedActions(
  invitation: {
    status: InvitationStatus;
    inviteeId: string;
    invitedById: string;
  },
  userId: string,
  isMember: boolean,
): InvitationAction[] {
  if (invitation.status !== 'PENDING_CONFIRMATION') return [];
  if (invitation.inviteeId === userId) return ['decline'];
  if (!isMember) return [];
  return invitation.invitedById === userId
    ? ['confirm', 'cancel']
    : ['confirm'];
}
