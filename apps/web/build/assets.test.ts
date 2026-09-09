import { describe, expect, it } from 'vitest';
import { PNG } from 'pngjs';
import jsQR from 'jsqr';
import { buildConfig } from './config';
import { buildAssets } from './assets';

describe('Pages assets', () => {
  it('keeps association files outside the invite rewrite and disables QRs for missing stores', async () => {
    const assets = await buildAssets(buildConfig({}));
    expect(Object.keys(assets).some((path) => path.startsWith('qr/'))).toBe(
      false,
    );
    expect(assets._redirects).toBe('/invite/* / 200\n');
    expect(assets).toHaveProperty('404.html');
    expect(assets._headers).toContain('Content-Type: application/json');
    expect(assets._headers).toContain('Cache-Control: no-store');
  });
  it('generates QR codes which decode to the fixed store URLs', async () => {
    const stores = {
      WEB_IOS_STORE_URL: 'https://apps.apple.com/jp/app/id123',
      WEB_ANDROID_STORE_URL:
        'https://play.google.com/store/apps/details?id=com.futa.stamprally',
    };
    const assets = await buildAssets(buildConfig(stores));
    for (const [path, url] of [
      ['qr/ios.png', stores.WEB_IOS_STORE_URL],
      ['qr/android.png', stores.WEB_ANDROID_STORE_URL],
    ]) {
      const png = PNG.sync.read(Buffer.from(assets[path]));
      expect(
        jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data,
      ).toBe(url);
    }
  });
  it.each([
    { WEB_API_URL: 'https://user@example.com' },
    { WEB_API_URL: 'https://example.com/api#fragment' },
    { WEB_API_URL: 'http://api.example.com' },
    { WEB_IOS_STORE_URL: 'javascript:alert(1)' },
    { WEB_ANDROID_STORE_URL: 'https://play.google.com.evil.test/app' },
  ])('rejects invalid deployment configuration %o', (env) =>
    expect(() => buildConfig(env)).toThrow(),
  );
  it('allows a local HTTP API without needing the web host', () => {
    expect(buildConfig({ WEB_API_URL: 'http://127.0.0.1:3000/' }).apiUrl).toBe(
      'http://127.0.0.1:3000',
    );
  });
});
