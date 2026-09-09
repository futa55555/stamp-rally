import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppNotification } from '../../features/notifications/model/types';
import { NotificationsScreen } from './NotificationsScreen';

const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  markRead: vi.fn(),
  guard: vi.fn(),
  push: vi.fn(),
  dispatch: vi.fn(),
  userId: 'recipient',
  notifications: [] as AppNotification[],
}));
vi.mock('expo-router', () => ({
  useRouter: () => ({ push: mocks.push }),
  useNavigation: () => ({ getParent: () => ({ dispatch: mocks.dispatch }) }),
}));
vi.mock('../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    userId: mocks.userId,
    client: {
      request: mocks.request,
      sessionGuard: () => mocks.guard,
      snapshot: () => ({ user: { id: mocks.userId } }),
    },
    actions: { markNotificationRead: mocks.markRead },
  }),
}));
vi.mock('../../features/notifications/hooks', () => ({
  useNotifications: () => ({
    notifications: mocks.notifications,
    data: {},
    invalidate: vi.fn(),
  }),
}));
vi.mock('react-native', () => ({ View: 'View', Pressable: 'Pressable' }));
vi.mock('../../shared/ui/ListScreen', () => ({ ListScreen: 'ListScreen' }));
vi.mock('../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
vi.mock('../../shared/ui/QueryState', () => ({ QueryState: 'QueryState' }));
vi.mock('../../shared/ui/EmptyState', () => ({ EmptyState: 'EmptyState' }));
vi.mock('../../shared/ui/Icon', () => ({ Icon: 'Icon' }));
vi.mock('../../shared/ui/UnreadBadge', () => ({ UnreadBadge: 'UnreadBadge' }));
vi.mock('../../shared/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({}),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let view: ReturnType<typeof create> | undefined;
beforeEach(() => {
  vi.resetAllMocks();
  const error = console.error;
  vi.spyOn(console, 'error').mockImplementation((...args) => {
    if (!String(args[0]).startsWith('react-test-renderer is deprecated'))
      error(...args);
  });
  mocks.userId = 'recipient';
  mocks.notifications = [];
  mocks.markRead.mockResolvedValue(undefined);
});
afterEach(async () => {
  await act(async () => view?.unmount());
  view = undefined;
  vi.restoreAllMocks();
});

async function open(target: AppNotification['target']) {
  mocks.notifications = [
    {
      id: 'notification',
      recipientId: mocks.userId,
      title: '通知',
      body: '招待',
      readAt: null,
      createdAt: '2026-09-10T00:00:00Z',
      target,
    },
  ];
  await act(async () => {
    view = create(createElement(NotificationsScreen));
  });
  const list = view!.root.findByType('ListScreen' as never);
  expect(list.props.ListHeaderComponent).toBeNull();
  const row = list.props.renderItem({ item: mocks.notifications[0] });
  await act(async () => row.props.onPress());
}

describe('invitation notification navigation', () => {
  it('opens the received invitation to apply, marking it read after access is checked', async () => {
    await open({ type: 'invitation-link', linkId: 'link' });
    expect(mocks.request).toHaveBeenCalledWith({
      url: '/invitation-links/link',
    });
    expect(mocks.markRead).toHaveBeenCalledWith('notification');
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: '/invitations/received/[linkId]',
      params: { linkId: 'link' },
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
  it('opens the trip invitation management screen for a member receiving an application', async () => {
    mocks.userId = 'sender';
    mocks.request.mockResolvedValue({
      id: 'request',
      tripId: 'trip',
      inviteeId: 'recipient',
    });
    await open({ type: 'invitation', invitationId: 'request' });
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: '/invitations/trip/[tripId]',
      params: { tripId: 'trip' },
    });
  });
  it('opens the applicant’s own application for a result notification', async () => {
    mocks.request.mockResolvedValue({
      id: 'request',
      tripId: 'trip',
      inviteeId: 'recipient',
    });
    await open({ type: 'invitation', invitationId: 'request' });
    expect(mocks.push).toHaveBeenCalledWith({
      pathname: '/invitations/[id]',
      params: { id: 'request' },
    });
  });
  it('keeps inaccessible notifications unread', async () => {
    mocks.request.mockRejectedValue(new Error('招待が見つかりません。'));
    await open({ type: 'invitation-link', linkId: 'deleted' });
    expect(mocks.markRead).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('never navigates after the session changes while marking a notification read', async () => {
    mocks.markRead.mockImplementation(async () => {
      mocks.guard.mockImplementation(() => {
        throw new Error('Session changed');
      });
    });
    await open({ type: 'invitation-link', linkId: 'link' });
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
