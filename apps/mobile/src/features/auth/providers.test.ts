import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { identityCredentials } from './providers';
const native = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  available: vi.fn(),
  apple: vi.fn(),
  nonce: vi.fn(),
  configure: vi.fn(),
  playServices: vi.fn(),
  google: vi.fn(),
}));
vi.mock('react-native', () => ({ Platform: native.platform }));
vi.mock('expo-apple-authentication', () => ({
  isAvailableAsync: native.available,
  signInAsync: native.apple,
}));
vi.mock('expo-crypto', () => ({ randomUUID: native.nonce }));
vi.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: {
    configure: native.configure,
    checkPlayServices: native.playServices,
    presentExplicitSignIn: native.google,
  },
  isSuccessResponse: (response: { type: string }) =>
    response.type === 'success',
}));
beforeEach(() => {
  vi.resetAllMocks();
  native.platform.OS = 'ios';
});
afterEach(() => vi.unstubAllEnvs());

describe('native identity exchange', () => {
  it('uses a new Apple nonce each time and forwards exactly that nonce with the ID token', async () => {
    native.available.mockResolvedValue(true);
    native.nonce.mockReturnValueOnce('nonce-1').mockReturnValueOnce('nonce-2');
    native.apple.mockResolvedValue({ identityToken: 'apple-token' });
    expect(await identityCredentials('apple')).toEqual({
      provider: 'apple',
      body: { identityToken: 'apple-token', nonce: 'nonce-1' },
    });
    expect(await identityCredentials('apple')).toEqual({
      provider: 'apple',
      body: { identityToken: 'apple-token', nonce: 'nonce-2' },
    });
    expect(native.apple.mock.calls).toEqual([
      [{ nonce: 'nonce-1' }],
      [{ nonce: 'nonce-2' }],
    ]);
  });
  it('cancels Apple login without exchanging a token', async () => {
    native.available.mockResolvedValue(true);
    native.apple.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
    expect(await identityCredentials('apple')).toBeNull();
  });
  it('configures explicit Google IDs and returns only the backend identity credential', async () => {
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'web-client');
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'ios-client');
    native.google.mockResolvedValue({
      type: 'success',
      data: { idToken: 'google-token', user: { email: 'unused' } },
    });
    expect(await identityCredentials('google')).toEqual({
      provider: 'google',
      body: { idToken: 'google-token' },
    });
    expect(native.configure).toHaveBeenCalledWith({
      webClientId: 'web-client',
      iosClientId: 'ios-client',
    });
    expect(native.playServices).not.toHaveBeenCalled();
    native.platform.OS = 'android';
    await identityCredentials('google');
    expect(native.playServices).toHaveBeenCalledOnce();
  });
  it('requires OAuth configuration and does not offer Apple authentication on Android', async () => {
    vi.stubEnv('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', '');
    await expect(identityCredentials('google')).rejects.toThrow('client ID');
    expect(native.google).not.toHaveBeenCalled();
    native.platform.OS = 'android';
    await expect(identityCredentials('apple')).rejects.toThrow('この端末');
    expect(native.apple).not.toHaveBeenCalled();
  });
});
