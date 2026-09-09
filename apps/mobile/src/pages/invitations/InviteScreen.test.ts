import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InviteScreen } from './InviteScreen';
import { InvitationControls } from './InvitationParts';
import type { Invitation } from '../../features/invitations/types';
import { ApiError } from '../../shared/api/errors';

const mocks = vi.hoisted(() => ({
  token: 'a'.repeat(43),
  linkId: undefined as string | undefined,
  user: null as { id: string; status: string } | null,
  request: vi.fn(),
  requestReceived: vi.fn(),
  decide: vi.fn(),
  guard: vi.fn(),
  replace: vi.fn(),
  clear: vi.fn(),
  capture: vi.fn(),
  refresh: vi.fn(),
  pending: { ready: true, token: null as string | null, error: null },
  preview: {} as Record<string, unknown>,
  error: null as Error | null,
  isFetching: false,
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mocks.token, linkId: mocks.linkId }),
  useRouter: () => ({ replace: mocks.replace, dismissTo: vi.fn() }),
}));
const client = {
  snapshot: () => ({ user: mocks.user }),
  sessionGuard: () => mocks.guard,
};
vi.mock('../../features/app-data/AppDataProvider', () => ({
  useData: () => ({
    user: mocks.user,
    client,
    actions: {
      requestInvitation: mocks.request,
      requestReceivedInvitation: mocks.requestReceived,
      decideInvitation: mocks.decide,
    },
  }),
}));
vi.mock('../../features/invitations/hooks', () => ({
  useInvitationPreview: () => ({
    data: mocks.preview,
    isPending: false,
    error: mocks.error,
    isFetching: mocks.isFetching,
    invalidate: mocks.refresh,
  }),
}));
vi.mock('../../features/invitations/runtime', () => ({
  pendingInvitation: {
    snapshot: () => mocks.pending,
    subscribe: () => () => {},
    capture: (token: string) => mocks.capture(token),
    clear: () => mocks.clear(),
  },
}));
vi.mock('../login/LoginScreen', () => ({ LoginScreen: 'LoginScreen' }));
vi.mock('../../app/onboarding', () => ({ default: 'Onboarding' }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('../../shared/ui/Screen', () => ({ Screen: 'Screen' }));
vi.mock('../../shared/ui/AppText', () => ({ AppText: 'AppText' }));
vi.mock('../../shared/ui/Button', () => ({ Button: 'Button' }));
vi.mock('../../shared/ui/ErrorMessage', () => ({
  ErrorMessage: 'ErrorMessage',
}));
vi.mock('../../shared/ui/PhotoImage', () => ({ PhotoImage: 'PhotoImage' }));
vi.mock('../../shared/ui/QueryState', () => ({ QueryState: 'QueryState' }));
vi.mock('../../shared/hooks/usePullToRefresh', () => ({
  usePullToRefresh: () => ({}),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const invitation = {
  id: 'request',
  generation: 2,
  inviteeId: 'applicant',
  invitedById: 'issuer',
  status: 'PENDING_CONFIRMATION',
  allowedActions: ['decline'],
  trip: {
    id: 'trip',
    name: '旅行',
    startDate: '2026-09-10',
    endDate: '2026-09-12',
    coverImageUrl: null,
  },
} as Invitation;
let view: ReturnType<typeof create> | undefined;
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.user = null;
  mocks.token = 'a'.repeat(43);
  mocks.linkId = undefined;
  mocks.error = null;
  mocks.isFetching = false;
  mocks.pending = { ready: true, token: mocks.token, error: null };
  mocks.preview = {
    trip: invitation.trip,
    createdBy: { name: '招待者' },
    canRequest: true,
    isMember: false,
    invitation: null,
    linkStatus: 'ACTIVE',
  };
  for (const fn of [
    mocks.clear,
    mocks.capture,
    mocks.refresh,
    mocks.request,
    mocks.requestReceived,
    mocks.decide,
  ])
    fn.mockReset().mockResolvedValue(undefined);
  mocks.guard.mockReset();
  mocks.replace.mockReset();
});
afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = undefined;
  vi.restoreAllMocks();
});
describe('Invitation screens', () => {
  it('reopens a received invitation without a token and applies only on an explicit tap', async () => {
    mocks.user = { id: 'applicant', status: 'ACTIVE' };
    mocks.token = '';
    mocks.linkId = 'received-link';
    mocks.requestReceived.mockResolvedValue(invitation);
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    expect(mocks.requestReceived).not.toHaveBeenCalled();
    expect(mocks.capture).not.toHaveBeenCalled();
    await act(async () =>
      view!.root
        .findAllByType('Button' as never)
        .find((button) => button.props.label === '参加を申請')!
        .props.onPress(),
    );
    expect(mocks.requestReceived).toHaveBeenCalledWith('received-link');
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/invitations/[id]',
      params: { id: 'request' },
    });
  });
  it('keeps an existing application accessible from an expired received link', async () => {
    mocks.user = { id: 'applicant', status: 'ACTIVE' };
    mocks.token = '';
    mocks.linkId = 'received-link';
    mocks.preview = {
      ...mocks.preview,
      linkStatus: 'EXPIRED',
      canRequest: false,
      invitation,
    };
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    const labels = view!.root
      .findAllByType('Button' as never)
      .map((button) => button.props.label);
    expect(labels).not.toContain('参加を申請');
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/invitations/[id]',
      params: { id: invitation.id },
    });
  });
  it('preserves the invite through login and onboarding, and submits only on an explicit tap', async () => {
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    expect(view!.root.findAllByType('LoginScreen' as never)).toHaveLength(1);
    expect(mocks.capture).toHaveBeenCalledWith(mocks.token);
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.user = { id: 'applicant', status: 'ONBOARDING' };
    await act(async () => view!.update(createElement(InviteScreen)));
    expect(view!.root.findAllByType('Onboarding' as never)).toHaveLength(1);
    mocks.user = { id: 'applicant', status: 'ACTIVE' };
    await act(async () => view!.update(createElement(InviteScreen)));
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.clear).toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    mocks.request.mockResolvedValue(invitation);
    const button = view!.root
      .findAllByType('Button' as never)
      .find((button) => button.props.label === '参加を申請')!;
    await act(async () => {
      button.props.onPress();
      button.props.onPress();
    });
    expect(mocks.request).toHaveBeenCalledTimes(1);
    expect(mocks.request).toHaveBeenCalledWith(mocks.token);
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/invitations/[id]',
      params: { id: 'request' },
    });
  });
  it('can cancel while signed out without recapturing the same URL', async () => {
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    const button = view!.root
      .findAllByType('Button' as never)
      .find((button) => button.props.label === 'トップに戻る')!;
    await act(async () => button.props.onPress());
    mocks.pending = { ...mocks.pending, token: null };
    await act(async () => view!.update(createElement(InviteScreen)));
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith('/trips');
  });
  it.each(['ACTIVE', 'EXPIRED', 'REVOKED'])(
    'opens the trip immediately for an existing member through a %s link',
    async (linkStatus) => {
      mocks.user = { id: 'applicant', status: 'ACTIVE' };
      mocks.preview = {
        ...mocks.preview,
        linkStatus,
        isMember: true,
        canRequest: false,
        invitation: { ...invitation, status: 'ACCEPTED' },
      };
      await act(async () => {
        view = create(createElement(InviteScreen));
      });
      expect(mocks.replace).toHaveBeenCalledWith({
        pathname: '/trips/trip/[tripId]',
        params: { tripId: 'trip' },
      });
      expect(mocks.request).not.toHaveBeenCalled();
    },
  );
  it.each(['ACTIVE', 'EXPIRED', 'REVOKED'])(
    'opens the application for a pending applicant through a %s link',
    async (linkStatus) => {
      mocks.user = { id: 'applicant', status: 'ACTIVE' };
      mocks.preview = {
        ...mocks.preview,
        linkStatus,
        canRequest: false,
        invitation,
      };
      await act(async () => {
        view = create(createElement(InviteScreen));
      });
      expect(mocks.replace).toHaveBeenCalledWith({
        pathname: '/invitations/[id]',
        params: { id: 'request' },
      });
    },
  );
  it.each(['DECLINED', 'CANCELLED'])(
    'shows the %s result on the same active link and an application on a new link',
    async (status) => {
      mocks.user = { id: 'applicant', status: 'ACTIVE' };
      mocks.preview = {
        ...mocks.preview,
        canRequest: false,
        invitation: { ...invitation, status },
      };
      await act(async () => {
        view = create(createElement(InviteScreen));
      });
      expect(mocks.replace).toHaveBeenCalledWith({
        pathname: '/invitations/[id]',
        params: { id: 'request' },
      });
      mocks.replace.mockClear();
      mocks.preview = { ...mocks.preview, canRequest: true };
      await act(async () => view!.update(createElement(InviteScreen)));
      expect(mocks.replace).not.toHaveBeenCalled();
      expect(
        view!.root.findAllByType('Button' as never).map((b) => b.props.label),
      ).toContain('参加を申請');
    },
  );
  it.each([404, 410])(
    'shows an unavailable link on HTTP %s and clears the invitation on return to top',
    async (status) => {
      mocks.user = { id: 'applicant', status: 'ACTIVE' };
      mocks.error = new ApiError('Unavailable', status);
      await act(async () => {
        view = create(createElement(InviteScreen));
      });
      expect(JSON.stringify(view!.toJSON())).toContain(
        'この招待リンクは利用できません',
      );
      expect(mocks.replace).not.toHaveBeenCalled();
      await act(async () =>
        view!.root
          .findAllByType('Button' as never)
          .find((b) => b.props.label === 'トップに戻る')!
          .props.onPress(),
      );
      expect(mocks.clear).toHaveBeenCalled();
      expect(mocks.replace).toHaveBeenCalledWith('/trips');
    },
  );
  it('keeps communication errors retryable and does not navigate using stale cached membership', async () => {
    mocks.user = { id: 'applicant', status: 'ACTIVE' };
    mocks.preview = { ...mocks.preview, isMember: true };
    mocks.isFetching = true;
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.isFetching = false;
    mocks.error = new ApiError('Offline');
    await act(async () => view!.update(createElement(InviteScreen)));
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(
      view!.root.findByType('QueryState' as never).props.query.invalidate,
    ).toBe(mocks.refresh);
    expect(JSON.stringify(view!.toJSON())).not.toContain(
      'この招待リンクは利用できません',
    );
  });
  it('never navigates with an old-session request response', async () => {
    mocks.user = { id: 'applicant', status: 'ACTIVE' };
    mocks.request.mockImplementation(async () => {
      mocks.guard.mockImplementation(() => {
        throw new Error('Session changed');
      });
      return invitation;
    });
    await act(async () => {
      view = create(createElement(InviteScreen));
    });
    await act(async () =>
      view!.root
        .findAllByType('Button' as never)
        .find((button) => button.props.label === '参加を申請')!
        .props.onPress(),
    );
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('uses the server-provided actions and generation; refreshes after a conflict', async () => {
    mocks.decide.mockRejectedValue(new Error('すでに終了しています'));
    const props = {
      invitation: {
        ...invitation,
        allowedActions: [
          'confirm',
        ] as const as unknown as Invitation['allowedActions'],
      },
      refresh: mocks.refresh,
    };
    await act(async () => {
      view = create(createElement(InvitationControls, props));
    });
    const buttons = view!.root.findAllByType('Button' as never);
    expect(buttons.map((button) => button.props.label)).toEqual(['参加を承認']);
    await act(async () => buttons[0].props.onPress());
    expect(mocks.decide).toHaveBeenCalledWith('request', 'confirm', 2);
    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(view!.root.findByType('ErrorMessage' as never).props.message).toBe(
      'すでに終了しています',
    );
    await act(async () =>
      view!.update(
        createElement(InvitationControls, {
          ...props,
          invitation: { ...invitation, status: 'ACCEPTED', allowedActions: [] },
        }),
      ),
    );
    expect(view!.root.findAllByType('Button' as never)).toHaveLength(0);
  });
});
