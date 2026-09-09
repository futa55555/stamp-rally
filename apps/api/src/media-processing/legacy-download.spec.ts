import { isPublicAddress, validateLegacyUrl } from './legacy-download.js';

describe('legacy migration source restrictions', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '192.168.1.1',
    '172.16.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    '::ffff:127.0.0.1',
    'fd00::1',
    'fe80::1',
    '2001:db8::1',
    '2002:7f00:1::',
  ])('rejects private, mapped, and reserved address %s', (ip) => {
    expect(isPublicAddress(ip)).toBe(false);
  });
  it.each(['1.1.1.1', '8.8.8.8', '2606:4700:4700::1111'])(
    'allows public address %s',
    (ip) => {
      expect(isPublicAddress(ip)).toBe(true);
    },
  );
  it('requires exact HTTPS origins and rejects URL credentials', () => {
    const allowed = ['https://images.example.com'];
    expect(
      validateLegacyUrl('https://images.example.com/a.jpg', allowed).pathname,
    ).toBe('/a.jpg');
    expect(() =>
      validateLegacyUrl('http://images.example.com/a.jpg', allowed),
    ).toThrow();
    expect(() =>
      validateLegacyUrl('https://images.example.com.evil.test/a.jpg', allowed),
    ).toThrow();
    expect(() =>
      validateLegacyUrl('https://user:pass@images.example.com/a.jpg', allowed),
    ).toThrow();
    expect(() =>
      validateLegacyUrl('https://images.example.com/a.jpg', []),
    ).toThrow();
  });
});
