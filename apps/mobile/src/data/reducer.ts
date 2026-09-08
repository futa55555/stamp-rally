import type { AppData, AppNotification, Post, User } from './types';
import { applyDomainChange, type DomainChange } from './mutations';

export type StoreState = {
  data: AppData | null;
  userId: string | null;
  error: string | null;
};
export const initialState: StoreState = {
  data: null,
  userId: null,
  error: null,
};
export type Action =
  | DomainChange
  | { type: 'loaded'; data: AppData }
  | { type: 'failed'; message: string | null }
  | { type: 'signedIn'; userId: string }
  | { type: 'signedOut' }
  | { type: 'favoriteUpdated'; post: Post }
  | { type: 'photoRead'; userId: string; postId: string }
  | { type: 'notificationRead'; notification: AppNotification }
  | { type: 'nameUpdated'; user: User };

export function reducer(state: StoreState, action: Action): StoreState {
  if (action.type === 'loaded')
    return { ...state, data: action.data, error: null };
  if (action.type === 'failed') return { ...state, error: action.message };
  if (action.type === 'signedIn') return { ...state, userId: action.userId };
  if (action.type === 'signedOut') return { ...state, userId: null };
  const data = state.data;
  if (!data) return state;
  switch (action.type) {
    case 'tripSaved':
    case 'genreSaved':
    case 'stampSaved':
    case 'postsCreated':
      return { ...state, data: applyDomainChange(data, action) };
    case 'favoriteUpdated':
      return {
        ...state,
        data: {
          ...data,
          posts: data.posts.map((p) =>
            p.id === action.post.id ? action.post : p,
          ),
        },
      };
    case 'photoRead':
      return {
        ...state,
        data: {
          ...data,
          readPhotoIds: {
            ...data.readPhotoIds,
            [action.userId]: [
              ...new Set([
                ...(data.readPhotoIds[action.userId] ?? []),
                action.postId,
              ]),
            ],
          },
        },
      };
    case 'notificationRead':
      return {
        ...state,
        data: {
          ...data,
          notifications: data.notifications.map((n) =>
            n.id === action.notification.id ? action.notification : n,
          ),
        },
      };
    case 'nameUpdated':
      return {
        ...state,
        data: {
          ...data,
          users: data.users.map((u) =>
            u.id === action.user.id ? action.user : u,
          ),
        },
      };
  }
}
