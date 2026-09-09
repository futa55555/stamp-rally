import { lookup } from 'node:dns/promises';
import { createWriteStream } from 'node:fs';
import { request } from 'node:https';
import { BlockList, isIP } from 'node:net';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const forbiddenV4 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const)
  forbiddenV4.addSubnet(address, prefix, 'ipv4');
const globalV6 = new BlockList();
globalV6.addSubnet('2000::', 3, 'ipv6');
const forbiddenV6 = new BlockList();
for (const [address, prefix] of [
  ['2001::', 32],
  ['2001:db8::', 32],
  ['2002::', 16],
] as const)
  forbiddenV6.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) return !forbiddenV4.check(address, 'ipv4');
  if (isIP(address) === 6)
    return (
      globalV6.check(address, 'ipv6') && !forbiddenV6.check(address, 'ipv6')
    );
  return false;
}

export function validateLegacyUrl(
  rawUrl: string,
  allowedOrigins: string[],
): URL {
  const url = new URL(rawUrl);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    !allowedOrigins.includes(url.origin)
  ) {
    throw new Error(
      'LEGACY_ORIGIN_NOT_ALLOWED: configure MEDIA_LEGACY_ALLOWED_ORIGINS with trusted HTTPS origins',
    );
  }
  return url;
}

/** Exact trusted origins, no redirects, and DNS pinned after rejecting private addresses. */
export async function downloadLegacy(
  rawUrl: string,
  path: string,
  maxBytes: number,
  allowedOrigins: string[],
): Promise<void> {
  const url = validateLegacyUrl(rawUrl, allowedOrigins);
  const addresses = await lookup(url.hostname.replace(/^\[|\]$/g, ''), {
    all: true,
    verbatim: true,
  });
  if (
    !addresses.length ||
    addresses.some(({ address }) => !isPublicAddress(address))
  )
    throw new Error('LEGACY_PRIVATE_ADDRESS_FORBIDDEN');
  const pinned = addresses[0];
  await new Promise<void>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        signal: AbortSignal.timeout(15 * 60_000),
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [pinned]);
          else callback(null, pinned.address, pinned.family);
        },
      },
      (response) => {
        if (
          response.statusCode !== 200 ||
          Number(response.headers['content-length'] ?? 0) > maxBytes
        ) {
          response.destroy();
          reject(new Error('LEGACY_DOWNLOAD_REJECTED'));
          return;
        }
        let byteSize = 0;
        const bound = new Transform({
          transform(chunk: Buffer, _encoding, callback) {
            byteSize += chunk.length;
            callback(
              byteSize > maxBytes ? new Error('MEDIA_SIZE_EXCEEDED') : null,
              chunk,
            );
          },
        });
        pipeline(
          response,
          bound,
          createWriteStream(path, { flags: 'wx', mode: 0o600 }),
        ).then(resolve, reject);
      },
    );
    req.on('error', reject);
    req.end();
  });
}
