import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationIntake } from './InvitationIntake';
import { pendingInvitation } from './runtime';

const mocks = vi.hoisted(() => ({
  user: null as { id: string; status: string } | null,
  path: '/trips',
  listener: null as null | ((event: { url: string }) => void),
  initial: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  clear: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('expo-linking', () => ({
  getInitialURL: () => mocks.initial(),
  addEventListener: (
    _type: string,
    listener: (event: { url: string }) => void,
  ) => {
    mocks.listener = listener;
    return {
      remove: () => {
        mocks.listener = null;
      },
    };
  },
}));
vi.mock('./runtime', async () => {
  const { PendingInvitation } = await import('./PendingInvitation');
  return {
    invitationScheme: 'stamp-rally',
    publicInvitationOrigin: 'https://invite.example.com',
    pendingInvitation: new PendingInvitation({
      get: () => mocks.get(),
      set: (value) => mocks.set(value),
      clear: () => mocks.clear(),
    }),
  };
});
const router = { replace: mocks.replace };
vi.mock('expo-router', () => ({
  useRouter: () => router,
  usePathname: () => mocks.path,
  useRootNavigationState: () => ({ key: 'root' }),
}));
vi.mock('../app-data/AppDataProvider', () => ({
  useData: () => ({ user: mocks.user }),
}));
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const token = 'a'.repeat(43);
const origin = 'https://invite.example.com';
let view: ReturnType<typeof create> | undefined;
beforeEach(async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  for (const fn of [mocks.initial, mocks.get])
    fn.mockReset().mockResolvedValue(null);
  for (const fn of [mocks.clear, mocks.set])
    fn.mockReset().mockResolvedValue(undefined);
  await pendingInvitation.clear();
  mocks.replace.mockReset();
  mocks.user = null;
  mocks.path = '/trips';
});
afterEach(async () => {
  if (view) await act(async () => view!.unmount());
  view = undefined;
  vi.restoreAllMocks();
});
const mount = async () =>
  act(async () => {
    view = create(createElement(InvitationIntake));
  });
const receive = async (url: string) =>
  act(async () => mocks.listener!({ url }));

describe('Invitation link intake', () => {
  it('restores a cold-start invite through login and name setup, replacing the route only when active', async () => {
    mocks.initial.mockResolvedValue(origin + '/invite/' + token);
    await mount();
    expect(pendingInvitation.snapshot().token).toBe(token);
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.user = { id: 'user', status: 'ONBOARDING' };
    await act(async () => view!.update(createElement(InvitationIntake)));
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.user = { id: 'user', status: 'ACTIVE' };
    await act(async () => view!.update(createElement(InvitationIntake)));
    expect(mocks.replace).toHaveBeenCalledWith({
      pathname: '/invite/[token]',
      params: { token },
    });
  });
  it('handles a warm invite and clears it when the public top URL is opened', async () => {
    mocks.user = { id: 'user', status: 'ACTIVE' };
    await mount();
    await receive(origin + '/invite/' + token);
    expect(mocks.replace).toHaveBeenLastCalledWith({
      pathname: '/invite/[token]',
      params: { token },
    });
    await receive(origin + '/');
    expect(pendingInvitation.snapshot().token).toBeNull();
    expect(mocks.replace).toHaveBeenLastCalledWith('/');
    expect(mocks.clear).toHaveBeenCalled();
  });
  it('lets a cold-start top link discard an invite saved in a previous app session', async () => {
    mocks.get.mockResolvedValue(
      JSON.stringify({ token, expiresAt: Date.now() + 60000 }),
    );
    mocks.initial.mockResolvedValue(origin);
    await mount();
    expect(pendingInvitation.snapshot().token).toBeNull();
    expect(mocks.replace).toHaveBeenLastCalledWith('/');
    mocks.user = { id: 'user', status: 'ACTIVE' };
    mocks.replace.mockClear();
    await act(async () => view!.update(createElement(InvitationIntake)));
    expect(mocks.replace).not.toHaveBeenCalled();
  });
  it('does not recapture a late initial URL after a newer top link', async () => {
    let finish!: (url: string) => void;
    mocks.initial.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    await mount();
    await receive(origin + '/');
    await act(async () => finish(origin + '/invite/' + token));
    expect(pendingInvitation.snapshot().token).toBeNull();
    expect(mocks.replace).toHaveBeenLastCalledWith('/');
  });
  it('ignores top URLs for other hosts without discarding a pending invitation', async () => {
    await mount();
    await receive(origin + '/invite/' + token);
    await receive('https://untrusted.example.com/');
    expect(pendingInvitation.snapshot().token).toBe(token);
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
