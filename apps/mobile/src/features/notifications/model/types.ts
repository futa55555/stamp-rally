export type NotificationTarget =
  | { type: 'invitation-link'; linkId: string }
  | { type: 'invitation'; invitationId: string }
  | { type: 'trip'; tripId: string }
  | { type: 'genre'; genreId: string }
  | { type: 'stamp'; stampId: string }
  | { type: 'photo'; postId: string }
  | { type: 'video'; postId: string };

export type AppNotification = {
  id: string;
  recipientId: string;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  target: NotificationTarget;
};
