import QRCode from 'qrcode';
import type { WebConfig } from '../src/config.ts';

export async function buildAssets(config: WebConfig) {
  const assets: Record<string, string | Uint8Array> = {
    // Only invitation routes are rewritten; association files are real assets.
    _redirects: '/invite/* / 200\n',
    _headers: `/*
  Referrer-Policy: no-referrer
  X-Content-Type-Options: nosniff
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'${config.apiUrl ? ' ' + new URL(config.apiUrl).origin : ''}; base-uri 'none'; frame-ancestors 'none'; form-action 'none'

/invite/*
  Cache-Control: no-store
  X-Robots-Tag: noindex, nofollow

/.well-known/apple-app-site-association
  Content-Type: application/json
  Cache-Control: public, max-age=300

/.well-known/assetlinks.json
  Content-Type: application/json
  Cache-Control: public, max-age=300
`,
    // Disable Pages' catch-all SPA fallback, including for missing .well-known files.
    '404.html':
      '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>stamp rally</title><h1>ページが見つかりません</h1><a href="/">トップに戻る</a></html>',
  };
  for (const [id, url] of [
    ['ios', config.iosStoreUrl],
    ['android', config.androidStoreUrl],
  ] as const) {
    if (url)
      assets['qr/' + id + '.png'] = await QRCode.toBuffer(url, {
        width: 256,
        margin: 4,
        errorCorrectionLevel: 'M',
      });
  }
  return assets;
}
