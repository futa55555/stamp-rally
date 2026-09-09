import type { WebConfig } from '../src/config.ts';

function url(value: string | undefined, name: string, local = false) {
  if (!value?.trim()) return null;
  const parsed = new URL(value.trim());
  if (
    (parsed.protocol !== 'https:' &&
      !(
        local &&
        parsed.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(parsed.hostname)
      )) ||
    parsed.username ||
    parsed.password
  )
    throw new Error(name + ' must be an HTTPS URL');
  return parsed;
}

export function buildConfig(
  env: Record<string, string | undefined>,
): WebConfig {
  const api = url(env.WEB_API_URL, 'WEB_API_URL', true);
  if (api && (api.search || api.hash))
    throw new Error('WEB_API_URL must not contain a query or fragment');
  const iosStore = url(env.WEB_IOS_STORE_URL, 'WEB_IOS_STORE_URL');
  const androidStore = url(env.WEB_ANDROID_STORE_URL, 'WEB_ANDROID_STORE_URL');
  if (iosStore && iosStore.hostname !== 'apps.apple.com')
    throw new Error('WEB_IOS_STORE_URL must use apps.apple.com');
  if (androidStore && androidStore.hostname !== 'play.google.com')
    throw new Error('WEB_ANDROID_STORE_URL must use play.google.com');
  return {
    apiUrl: api?.href.replace(/\/+$/, '') ?? null,
    iosStoreUrl: iosStore?.href ?? null,
    androidStoreUrl: androidStore?.href ?? null,
  };
}
