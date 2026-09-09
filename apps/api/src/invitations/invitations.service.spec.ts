import { allowedActions } from './entities/invitation.entity.js';

describe('Invitation permissions', () => {
  const invitation = {
    status: 'PENDING_CONFIRMATION' as const,
    invitedById: 'sender',
    inviteeId: 'recipient',
  };
  it('allows any existing participant to confirm but only the issuer to cancel', () => {
    expect(allowedActions(invitation, 'sender', true)).toEqual([
      'confirm',
      'cancel',
    ]);
    expect(allowedActions(invitation, 'other-member', true)).toEqual([
      'confirm',
    ]);
    expect(allowedActions(invitation, 'outsider', false)).toEqual([]);
  });
  it('lets the applicant withdraw, never self-confirm', () => {
    expect(allowedActions(invitation, 'recipient', false)).toEqual(['decline']);
    expect(allowedActions(invitation, 'recipient', true)).toEqual(['decline']);
  });
  it.each(['ACCEPTED', 'DECLINED', 'CANCELLED', 'PENDING'] as const)(
    'offers no actions for %s',
    (status) => {
      expect(allowedActions({ ...invitation, status }, 'sender', true)).toEqual(
        [],
      );
    },
  );
});
