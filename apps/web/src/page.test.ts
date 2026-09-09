// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountPage, platform } from './page';
import type { WebConfig } from './config';

const token = 'a'.repeat(43);
const config: WebConfig = {
  apiUrl: 'https://api.example.com',
  iosStoreUrl: 'https://apps.apple.com/app/id123',
  androidStoreUrl:
    'https://play.google.com/store/apps/details?id=com.example.app',
};
const root = document.createElement('main');
const fetchMock = vi.fn<typeof fetch>();
const replace = vi.fn();
const environment = (pathname = '/', userAgent = 'Desktop') => ({
  pathname,
  userAgent,
  maxTouchPoints: 0,
  fetch: fetchMock,
  replace,
});
beforeEach(() => {
  vi.resetAllMocks();
  root.replaceChildren();
  document.body.append(root);
});
afterEach(() => {
  root.remove();
  vi.useRealTimers();
});
const statusResponse = (status: string) =>
  new Response(JSON.stringify({ status }));

describe('Download and invitation page', () => {
  it('shows both store links and locally generated QRs on desktop', async () => {
    await mountPage(root, config, environment());
    expect(
      [...root.querySelectorAll<HTMLAnchorElement>('.badge-link')].map(
        (a) => a.href,
      ),
    ).toEqual([config.iosStoreUrl, config.androidStoreUrl]);
    expect(
      [...root.querySelectorAll<HTMLImageElement>('.qr')].map((img) =>
        img.getAttribute('src'),
      ),
    ).toEqual(['/qr/ios.png', '/qr/android.png']);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it.each([
    ['iPhone', config.iosStoreUrl],
    ['Android', config.androidStoreUrl],
  ])(
    'redirects %s at the top and only after a valid invitation is confirmed',
    async (ua, target) => {
      await mountPage(root, config, environment('/', ua!));
      expect(replace).toHaveBeenCalledExactlyOnceWith(target);
      replace.mockClear();
      let resolve!: (value: Response) => void;
      fetchMock.mockImplementation(
        () =>
          new Promise((done) => {
            resolve = done;
          }),
      );
      const pending = mountPage(
        root,
        config,
        environment('/invite/' + token, ua!),
      );
      expect(replace).not.toHaveBeenCalled();
      expect(root.getAttribute('aria-busy')).toBe('true');
      resolve(statusResponse('ACTIVE'));
      await pending;
      expect(replace).toHaveBeenCalledExactlyOnceWith(target);
      expect(fetchMock).toHaveBeenCalledWith(
        config.apiUrl + '/public/invitation-links/status',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ token }),
          cache: 'no-store',
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
        }),
      );
    },
  );
  it.each(['EXPIRED', 'REVOKED', 'NOT_FOUND'])(
    'does not redirect or display store links for %s',
    async (status) => {
      fetchMock.mockResolvedValue(statusResponse(status));
      await mountPage(root, config, environment('/invite/' + token, 'iPhone'));
      expect(root.textContent).toContain('利用できません');
      expect(root.querySelector('a')?.getAttribute('href')).toBe('/');
      expect(root.querySelector('.stores')).toBeNull();
      expect(replace).not.toHaveBeenCalled();
    },
  );
  it.each([
    '/invite/short',
    '/invite/',
    '/invite/' + token + '/extra',
    '/missing',
  ])('rejects malformed path %s without a status request', async (pathname) => {
    await mountPage(root, config, environment(pathname, 'Android'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
    expect(root.textContent).toContain('利用できません');
  });
  it.each(['offline', '500', 'bad-json', 'unknown'])(
    'offers retry for %s and never treats the failure as expiration',
    async (failure) => {
      if (failure === 'offline')
        fetchMock.mockRejectedValueOnce(new Error('Offline'));
      else
        fetchMock.mockResolvedValueOnce(
          failure === '500'
            ? new Response('', { status: 500 })
            : failure === 'bad-json'
              ? new Response('invalid')
              : statusResponse('UNKNOWN'),
        );
      await mountPage(root, config, environment('/invite/' + token, 'iPhone'));
      expect(root.textContent).toContain('再試行');
      expect(root.textContent).not.toContain('利用できません');
      expect(replace).not.toHaveBeenCalled();
      fetchMock.mockResolvedValueOnce(statusResponse('ACTIVE'));
      root.querySelector('button')!.click();
      await vi.waitFor(() =>
        expect(replace).toHaveBeenCalledWith(config.iosStoreUrl),
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
  );
  it('times out stalled status requests with a retry', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('Aborted')),
          );
        }),
    );
    const pending = mountPage(
      root,
      config,
      environment('/invite/' + token, 'iPhone'),
    );
    await vi.advanceTimersByTimeAsync(10000);
    await pending;
    expect(root.textContent).toContain('再試行');
    expect(replace).not.toHaveBeenCalled();
  });
  it.each(['/', '/invite/' + token])(
    'keeps unconfigured stores disabled on %s',
    async (pathname) => {
      fetchMock.mockResolvedValue(statusResponse('ACTIVE'));
      await mountPage(
        root,
        { ...config, iosStoreUrl: null, androidStoreUrl: null },
        environment(pathname, 'iPhone'),
      );
      expect(root.querySelectorAll('.coming-soon')).toHaveLength(2);
      expect(root.querySelectorAll('a, .qr')).toHaveLength(0);
      expect(replace).not.toHaveBeenCalled();
    },
  );
  it('does not redirect an iPhone to the other platform when its store is unconfigured', async () => {
    await mountPage(
      root,
      { ...config, iosStoreUrl: null },
      environment('/', 'iPhone'),
    );
    expect(root.querySelectorAll('.badge-link')).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  });
  it('keeps an unconfigured API retryable without sending a token to the web host', async () => {
    await mountPage(
      root,
      { ...config, apiUrl: null },
      environment('/invite/' + token, 'Android'),
    );
    expect(root.textContent).toContain('再試行');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
  it('recognizes iPad desktop mode without redirecting a Mac', () => {
    expect(platform('Macintosh', 5)).toBe('ios');
    expect(platform('Macintosh', 0)).toBe('desktop');
    expect(platform('iPad')).toBe('ios');
    expect(platform('iPod')).toBe('ios');
  });
});
