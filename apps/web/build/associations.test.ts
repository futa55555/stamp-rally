import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { associationAssets } from './associations';

vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
beforeEach(() => {
  vi.mocked(readFile).mockReset();
});

describe('Environment-specific association files', () => {
  it.each([
    ['localhost', 'local'],
    ['development', 'development'],
    ['staging', 'staging'],
    ['production', 'production'],
  ])(
    'copies only %s associations without rewriting their content',
    async (mode, directory) => {
      const fixtures = Object.fromEntries(
        ['local', 'development', 'staging', 'production'].flatMap(
          (environment) => [
            [
              `${environment}/apple-app-site-association`,
              JSON.stringify({
                applinks: {
                  details: [
                    {
                      appID: `TEAM123456.com.example.${environment}`,
                      paths: ['/', '/invite/*'],
                    },
                  ],
                },
              }) + '\n',
            ],
            [
              `${environment}/assetlinks.json`,
              JSON.stringify([
                { target: { package_name: `com.example.${environment}` } },
              ]) + '\n',
            ],
          ],
        ),
      );
      vi.mocked(readFile).mockImplementation(async (path) => {
        const key = (path as URL).pathname.split('/associations/')[1];
        return fixtures[key];
      });
      const assets = await associationAssets(mode);
      expect(assets).toEqual({
        '.well-known/apple-app-site-association':
          fixtures[directory + '/apple-app-site-association'],
        '.well-known/assetlinks.json': fixtures[directory + '/assetlinks.json'],
      });
      expect(readFile).toHaveBeenCalledTimes(2);
    },
  );
  it('rejects an unknown mode rather than silently selecting production', async () => {
    await expect(associationAssets('stg')).rejects.toThrow(
      'Use localhost, development, staging, or production',
    );
    expect(readFile).not.toHaveBeenCalled();
  });
  it('fails the build when an association file is invalid JSON', async () => {
    vi.mocked(readFile).mockResolvedValue('invalid JSON');
    await expect(associationAssets('production')).rejects.toThrow(SyntaxError);
  });
});
