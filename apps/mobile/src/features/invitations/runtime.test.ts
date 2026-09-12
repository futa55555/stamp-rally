import { afterEach, describe, expect, it, vi } from 'vitest';
import { invitationUrl } from './links';

const config = vi.hoisted(() => ({
  scheme: 'stamp-rally-local',
  extra: { appVariant: 'local' },
}));
vi.mock('expo-constants', () => ({ default: { expoConfig: config } }));
vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
afterEach(() => vi.unstubAllEnvs());

describe.each([
  ['local', 'stamp-rally-local', 'http://localhost:5173'],
  ['development', 'stamp-rally-dev', 'https://stamp-rally-dev.pages.dev'],
  ['staging', 'stamp-rally-stg', 'https://stamp-rally-stg.pages.dev'],
  ['production', 'stamp-rally', 'https://stamp-rally-9ok.pages.dev'],
])('invitation sharing in %s', (variant, scheme, origin) => {
  it.each([undefined, '', '  ', origin])(
    'uses only the configured origin: %s',
    async (value) => {
      vi.resetModules();
      config.scheme = scheme;
      config.extra.appVariant = variant;
      vi.stubEnv('EXPO_PUBLIC_INVITATION_ORIGIN', value);
      const runtime = await import('./runtime');
      const token = 'a'.repeat(43);
      if (value === origin) {
        expect(runtime.canShareInvitation).toBe(true);
        expect(invitationUrl(token, runtime.publicInvitationOrigin)).toBe(
          origin + '/invite/' + token,
        );
      } else {
        expect(runtime.canShareInvitation).toBe(false);
        expect(() =>
          invitationUrl(token, runtime.publicInvitationOrigin),
        ).toThrow('共有は準備中');
      }
    },
  );
});
