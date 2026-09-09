import { describe, expect, it } from 'vitest';
import {
  invitationSharingEnabled,
  invitationOrigin,
  invitationTokenFromUrl,
  invitationUrl,
} from './links';
const token = 'a'.repeat(43);
const origin = 'https://invite.example.com';
describe('Invitation URLs', () => {
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
    expect(invitationUrl(token, 'stamp-rally-local', null)).toBe(
      'stamp-rally-local://invite/' + token,
    );
    expect(invitationUrl(token, 'stamp-rally', origin)).toBe(
      origin + '/invite/' + token,
    );
  });
  it.each([
    'https://evil.example.com/invite/' + token,
    'https://invite.example.com.evil.test/invite/' + token,
    'http://invite.example.com/invite/' + token,
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
  ])('requires a plain HTTPS origin: %s', (value) => {
    expect(() => invitationOrigin(value)).toThrow();
  });
});

it('allows internal schemes on older builds while keeping production gated', () => {
  for (const scheme of [
    'stamp-rally-local',
    'stamp-rally-dev',
    'stamp-rally-stg',
  ])
    expect(invitationSharingEnabled(scheme, false)).toBe(true);
  expect(invitationSharingEnabled('stamp-rally', false)).toBe(false);
  expect(invitationSharingEnabled('unknown', false)).toBe(false);
  expect(invitationSharingEnabled('stamp-rally', true)).toBe(true);
});
