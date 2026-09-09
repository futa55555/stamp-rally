export const isInvitationToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export function invitationOrigin(value?: string): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('招待リンクのドメイン設定が正しくありません。');
  return url.origin;
}
export function invitationTokenFromUrl(
  value: string,
  scheme: string,
  origin: string | null,
): string | null {
  try {
    const url = new URL(value);
    let path: string;
    if (url.protocol === scheme + ':') path = '/' + url.hostname + url.pathname;
    else if (origin && url.origin === origin && url.protocol === 'https:')
      path = url.pathname;
    else return null;
    const match = path.match(/^\/invite\/([A-Za-z0-9_-]{43})\/?$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
export function isPublicTopUrl(value: string, origin: string | null): boolean {
  try {
    const url = new URL(value);
    return (
      !!origin &&
      url.origin === origin &&
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      url.pathname === '/'
    );
  } catch {
    return false;
  }
}
export function invitationUrl(
  token: string,
  scheme: string,
  origin: string | null,
) {
  if (!isInvitationToken(token))
    throw new Error('招待リンクが正しくありません。');
  return origin ? origin + '/invite/' + token : scheme + '://invite/' + token;
}

// The registered scheme also identifies older development builds that predate
// appVariant metadata. Production never falls back to a custom shared link.
export function invitationSharingEnabled(
  scheme: string,
  publicEnabled: boolean,
) {
  return (
    publicEnabled ||
    ['stamp-rally-local', 'stamp-rally-dev', 'stamp-rally-stg'].includes(scheme)
  );
}
