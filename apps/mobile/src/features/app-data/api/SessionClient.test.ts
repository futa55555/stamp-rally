import { ApiError } from '../../../shared/api/errors';
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { describe, it, expect, vi } from 'vitest';
import { SessionClient, type TokenStorage } from './SessionClient';

const user = { id: 'u1', name: '旅人', status: 'ACTIVE' as const };
const tokens = { accessToken: 'access-1', refreshToken: 'refresh-1' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup(
  handler: (config: InternalAxiosRequestConfig) => unknown | Promise<unknown>,
  initial: string | null = 'stored',
) {
  let persisted = initial;
  const storage: TokenStorage = {
    get: vi.fn(async () => persisted),
    set: vi.fn(async (value) => {
      persisted = value;
    }),
    clear: vi.fn(async () => {
      persisted = null;
    }),
  };
  const http = axios.create({
    adapter: async (config) => ({
      data: await handler(config),
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    }),
  });
  const clearCache = vi.fn();
  const client = new SessionClient('http://api', storage, clearCache, http);
  return { client, storage, clearCache, persisted: () => persisted };
}
function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('unauthorized', undefined, config, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    data: {},
    headers: {},
    config,
  });
}
async function signIn(client: SessionClient) {
  await client.signIn(async () => ({
    provider: 'google',
    body: { idToken: 'id-token' },
  }));
}

describe('session client', () => {
  it('starts signed out when SecureStore is empty without requesting trip data', async () => {
    const send = vi.fn();
    const { client } = setup(send, null);
    await client.restore();
    expect(client.snapshot().status).toBe('signedOut');
    expect(send).not.toHaveBeenCalled();
  });
  it('restores rotated tokens and preserves onboarding until the name is saved', async () => {
    const calls: string[] = [];
    const { client, persisted } = setup((config) => {
      calls.push(config.url!);
      if (config.url === '/auth/refresh') return tokens;
      if (config.method === 'patch') return user;
      return { ...user, name: null, status: 'ONBOARDING' };
    });
    await client.restore();
    expect(client.snapshot().user?.status).toBe('ONBOARDING');
    expect(persisted()).toBe(tokens.refreshToken);
    await client.updateName('旅人');
    expect(client.snapshot().user?.status).toBe('ACTIVE');
    expect(calls).toEqual(['/auth/refresh', '/users/me', '/users/me']);
  });
  it('deduplicates simultaneous 401 refreshes and replays each request once', async () => {
    const refresh = deferred<typeof tokens>();
    const requests: string[] = [];
    let refreshes = 0;
    const { client } = setup((config) => {
      if (config.url === '/auth/google') return tokens;
      if (config.url === '/users/me') return user;
      if (config.url === '/auth/refresh') {
        refreshes++;
        return refresh.promise;
      }
      requests.push(String(config.headers.Authorization));
      if (config.headers.Authorization === 'Bearer access-1')
        throw unauthorized(config);
      return { ok: true };
    });
    await signIn(client);
    const first = client.request({ url: '/trips' });
    const second = client.request({ url: '/genres' });
    await vi.waitFor(() => expect(refreshes).toBe(1));
    refresh.resolve({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);
    expect(refreshes).toBe(1);
    expect(requests).toEqual([
      'Bearer access-1',
      'Bearer access-1',
      'Bearer access-2',
      'Bearer access-2',
    ]);
  });
  it('reuses an already refreshed token for a late 401', async () => {
    const late = deferred<never>();
    let lateConfig!: InternalAxiosRequestConfig;
    let refreshes = 0;
    const { client } = setup((config) => {
      if (config.url === '/auth/google') return tokens;
      if (config.url === '/users/me') return user;
      if (config.url === '/auth/refresh') {
        refreshes++;
        return { accessToken: 'access-2', refreshToken: 'refresh-2' };
      }
      if (config.headers.Authorization === 'Bearer access-2') return 'ok';
      if (config.url === '/late') {
        lateConfig = config;
        return late.promise;
      }
      throw unauthorized(config);
    });
    await signIn(client);
    const pending = client.request({ url: '/late' });
    await expect(client.request({ url: '/fast' })).resolves.toBe('ok');
    late.reject(unauthorized(lateConfig));
    await expect(pending).resolves.toBe('ok');
    expect(refreshes).toBe(1);
  });
  it('does not retry a second 401 indefinitely', async () => {
    let requests = 0;
    let refreshes = 0;
    const { client } = setup((config) => {
      if (config.url === '/auth/google') return tokens;
      if (config.url === '/users/me') return user;
      if (config.url === '/auth/refresh') {
        refreshes++;
        return tokens;
      }
      requests++;
      throw unauthorized(config);
    });
    await signIn(client);
    await expect(client.request({ url: '/trips' })).rejects.toMatchObject({
      status: 401,
    });
    expect(requests).toBe(2);
    expect(refreshes).toBe(1);
  });
  it('clears authentication on rejected refresh but retains it on a network failure', async () => {
    let failAuth = false;
    const { client, persisted, clearCache } = setup((config) => {
      if (config.url === '/auth/google') return tokens;
      if (config.url === '/users/me') return user;
      if (config.url === '/auth/refresh' && !failAuth)
        throw new AxiosError('offline');
      throw unauthorized(config);
    });
    await signIn(client);
    await expect(client.request({ url: '/trips' })).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(client.snapshot().status).toBe('signedIn');
    expect(persisted()).toBe('refresh-1');
    failAuth = true;
    await expect(client.request({ url: '/trips' })).rejects.toMatchObject({
      status: 401,
    });
    expect(client.snapshot().status).toBe('signedOut');
    expect(persisted()).toBeNull();
    expect(clearCache).toHaveBeenCalledOnce();
  });
  it('allows retrying failed startup restoration', async () => {
    let online = false;
    const { client, persisted } = setup((config) => {
      if (!online) throw new AxiosError('offline');
      return config.url === '/auth/refresh' ? tokens : user;
    });
    await client.restore();
    expect(client.snapshot().status).toBe('error');
    expect(persisted()).toBe('stored');
    online = true;
    await client.restore();
    expect(client.snapshot().user).toEqual(user);
  });
  it('fences a native sign-in completion after logout', async () => {
    const credentials = deferred<{
      provider: 'google';
      body: { idToken: string };
    }>();
    const send = vi.fn();
    const { client, persisted } = setup(send);
    const result = client.signIn(() => credentials.promise);
    await client.signOut();
    credentials.resolve({ provider: 'google', body: { idToken: 'stale' } });
    await expect(result).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(client.snapshot().status).toBe('signedOut');
    expect(persisted()).toBeNull();
    expect(send).not.toHaveBeenCalled();
  });
  it('fences in-flight refresh and reads after logout and clears the cache immediately', async () => {
    const refresh = deferred<typeof tokens>();
    const { client, persisted, clearCache } = setup((config) => {
      if (config.url === '/auth/google') return tokens;
      if (config.url === '/users/me') return user;
      if (config.url === '/auth/refresh') return refresh.promise;
      if (config.url === '/auth/logout') return undefined;
      throw unauthorized(config);
    });
    await signIn(client);
    const result = client.request({ url: '/trips' });
    // Attach rejection handling before the abort.
    const rejected = expect(result).rejects.toMatchObject({
      code: 'ERR_CANCELED',
    });
    await Promise.resolve();
    await client.signOut();
    expect(clearCache).toHaveBeenCalledOnce();
    refresh.resolve({ accessToken: 'stale', refreshToken: 'stale' });
    await rejected;
    expect(client.snapshot().status).toBe('signedOut');
    expect(persisted()).toBeNull();
  });
  it('serializes SecureStore clearing behind a pending token write', async () => {
    const writing = deferred<void>();
    let persisted: string | null = 'old';
    const storage: TokenStorage = {
      get: async () => persisted,
      set: vi.fn(async (value) => {
        await writing.promise;
        persisted = value;
      }),
      clear: async () => {
        persisted = null;
      },
    };
    const http = axios.create({
      adapter: async (config) => ({
        data: tokens,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      }),
    });
    const client = new SessionClient('http://api', storage, vi.fn(), http);
    const login = signIn(client);
    await vi.waitFor(() => expect(storage.set).toHaveBeenCalledOnce());
    const logout = client.signOut();
    writing.resolve();
    await expect(login).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    await logout;
    expect(persisted).toBeNull();
    expect(client.snapshot().status).toBe('signedOut');
  });
});
