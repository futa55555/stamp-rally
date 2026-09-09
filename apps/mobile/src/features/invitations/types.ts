export type InvitationAction = 'confirm' | 'decline' | 'cancel';
export type Invitation = {
  id: string;
  tripId: string;
  inviteeId: string;
  invitedById: string;
  linkId: string | null;
  generation: number;
  status:
    'PENDING' | 'PENDING_CONFIRMATION' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
  trip: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    coverImageUrl: string | null;
  };
  invitee: { id: string; name: string };
  invitedBy: { id: string; name: string };
  allowedActions: InvitationAction[];
};
export type InvitationLink = {
  id: string;
  tripId: string;
  createdById: string;
  createdBy: { id: string; name: string };
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};
export type InvitationPreview = {
  id: string;
  trip: Invitation['trip'];
  createdBy: { id: string; name: string };
  expiresAt: string;
  linkStatus: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
  isMember: boolean;
  canRequest: boolean;
  invitation: Invitation | null;
};
export const invitationStatusLabels: Record<Invitation['status'], string> = {
  PENDING: '終了した招待',
  PENDING_CONFIRMATION: '参加者の承認待ち',
  ACCEPTED: '参加確定',
  DECLINED: '申請を撤回済み',
  CANCELLED: '申請は取り消されました',
};
