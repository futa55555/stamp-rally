import { describe, expect, it } from 'vitest';
import {
  invitationOrigin,
  invitationTokenFromUrl,
  invitationUrl,
  isPublicTopUrl,
} from './links';
const token = 'a'.repeat(43);
const origin = 'https://invite.example.com';
describe('Invitation URLs', () => {
  it('recognizes only the configured HTTPS top URL', () => {
    expect(isPublicTopUrl(origin + '/', origin)).toBe(true);
    expect(isPublicTopUrl(origin, origin)).toBe(true);
    for (const value of [
      'bad',
      origin + '/trips',
      origin + '/invite/' + token,
      'https://evil.example.com/',
      'http://invite.example.com/',
      'https://user@invite.example.com/',
    ])
      expect(isPublicTopUrl(value, origin)).toBe(false);
    expect(isPublicTopUrl(origin, null)).toBe(false);
  });
  it('routes HTTPS and current-environment custom links to the same token', () => {
    expect(
      invitationTokenFromUrl(
        origin + '/invite/' + token,
        'stamp-rally-local',
        origin,
      ),
    ).toBe(token);
    expect(
      invitationTokenFromUrl(
        'stamp-rally-local://invite/' + token,
        'stamp-rally-local',
        origin,
      ),
    ).toBe(token);
  });
  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://stamp-rally-dev.pages.dev',
    'https://stamp-rally-stg.pages.dev',
    'https://stamp-rally-9ok.pages.dev',
  ])('shares and recognizes links at the configured origin %s', (value) => {
    const configuredOrigin = invitationOrigin(' ' + value + '/ ', true);
    expect(configuredOrigin).toBe(value);
    const url = invitationUrl(token, configuredOrigin);
    expect(url).toBe(value + '/invite/' + token);
    expect(
      invitationTokenFromUrl(url, 'stamp-rally-local', configuredOrigin),
    ).toBe(token);
    expect(isPublicTopUrl(value + '/', configuredOrigin)).toBe(true);
  });
  it('does not generate a shared link without an origin or a valid token', () => {
    for (const value of [undefined, '', '  ']) {
      const configuredOrigin = invitationOrigin(value);
      expect(configuredOrigin).toBeNull();
      expect(() => invitationUrl(token, configuredOrigin)).toThrow(
        '共有は準備中',
      );
    }
    expect(() => invitationUrl('short', origin)).toThrow('正しくありません');
  });
  it('only accepts local HTTP when explicitly allowed and matches the exact origin', () => {
    const localOrigin = 'http://localhost:5173';
    expect(() => invitationOrigin(localOrigin)).toThrow();
    for (const value of [
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'https://localhost:5173',
      'http://localhost.evil.test:5173',
      'http://user@localhost:5173',
    ]) {
      expect(
        invitationTokenFromUrl(
          value + '/invite/' + token,
          'stamp-rally-local',
          localOrigin,
        ),
      ).toBeNull();
      expect(isPublicTopUrl(value + '/', localOrigin)).toBe(false);
    }
  });
  it.each([
    'https://evil.example.com/invite/' + token,
    'https://invite.example.com.evil.test/invite/' + token,
    'http://invite.example.com/invite/' + token,
    'https://user@invite.example.com/invite/' + token,
    'stamp-rally://invite/' + token,
    origin + '/invite/short',
    origin + '/trips/' + token,
    origin + '/invite/' + token + '/other',
  ])('rejects mismatched environments or malformed links: %s', (url) => {
    expect(invitationTokenFromUrl(url, 'stamp-rally-local', origin)).toBeNull();
  });
  it.each([
    'http://example.com',
    'https://example.com/path',
    'https://user@example.com',
    'https://example.com?x=1',
    'https://example.com:444',
    'http://localhost:5173/path',
    'http://user@localhost:5173',
    'http://localhost:5173?x=1',
    'http://localhost:5173#fragment',
    'http://localhost.evil.test:5173',
  ])('requires a plain HTTPS origin: %s', (value) => {
    expect(() => invitationOrigin(value)).toThrow();
    expect(() => invitationOrigin(value, true)).toThrow();
  });
});
