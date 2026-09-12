export const isInvitationToken = (token: unknown): token is string =>
  typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);

export function invitationOrigin(
  value?: string,
  allowLocalHttp = false,
): string | null {
  if (!value?.trim()) return null;
  const url = new URL(value.trim());
  const localHttp =
    allowLocalHttp &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname);
  if (
    (!localHttp && (url.protocol !== 'https:' || url.port)) ||
    url.username ||
    url.password ||
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
    else if (origin && url.origin === origin && !url.username && !url.password)
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
      !url.username &&
      !url.password &&
      url.pathname === '/'
    );
  } catch {
    return false;
  }
}
export function invitationUrl(token: string, origin: string | null) {
  if (!isInvitationToken(token))
    throw new Error('招待リンクが正しくありません。');
  if (!origin) throw new Error('招待リンクの共有は準備中です。');
  return origin + '/invite/' + token;
}
