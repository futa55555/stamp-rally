import type { ConfigContext, ExpoConfig } from 'expo/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import configure from './app.config';
import appJson from './app.json';
import eas from './eas.json';
import { validateRemoteEnvironment } from './scripts/validate-remote-env.mjs';

const context: ConfigContext = {
  projectRoot: process.cwd(),
  staticConfigPath: null,
  packageJsonPath: null,
  config: appJson.expo as ExpoConfig,
};
const requiredKeys = [
  'EXPO_PUBLIC_API_URL',
  'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
  'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
] as const;

function setRemoteEnvironment(
  variant: 'development' | 'staging' | 'production',
) {
  for (const [key, value] of Object.entries(eas.build[variant].env)) {
    vi.stubEnv(key, value);
  }
  vi.stubEnv('EXPO_PUBLIC_API_URL', `https://${variant}.example.com`);
  vi.stubEnv(
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    `${variant}-web.apps.googleusercontent.com`,
  );
  vi.stubEnv(
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
    `${variant}-ios.apps.googleusercontent.com`,
  );
}

beforeEach(() => {
  for (const key of ['APP_VARIANT', 'APPLE_TEAM_ID', ...requiredKeys]) {
    vi.stubEnv(key, undefined);
  }
});
afterEach(() => vi.unstubAllEnvs());

describe('app variants', () => {
  it('defaults to local and permits simulator configuration before OAuth setup', () => {
    const config = configure(context);
    expect(config.name).toBe('Stamp Rally Local');
    expect(config.ios?.bundleIdentifier).toBe('com.futa.stamprally.local');
    expect(config.android?.package).toBe('com.futa.stamprally.local');
    expect(config.scheme).toBe('stamp-rally-local');
    expect(config.ios?.appleTeamId).toBeUndefined();
    expect(config.plugins).toContainEqual([
      'expo-dev-client',
      { addGeneratedScheme: true },
    ]);
  });

  it.each([
    ['development', 'development', '.dev', '-dev', 'Stamp Rally Dev', true],
    ['staging', 'preview', '.stg', '-stg', 'Stamp Rally Stg', false],
    ['production', 'production', '', '', 'Stamp Rally', false],
  ] as const)(
    'resolves the %s EAS profile into the correct app',
    (variant, environment, idSuffix, schemeSuffix, name, developmentClient) => {
      setRemoteEnvironment(variant);
      const config = configure(context);
      expect(eas.build[variant].environment).toBe(environment);
      expect(eas.build[variant].ios.simulator).toBe(false);
      expect(eas.build[variant].developmentClient).toBe(developmentClient);
      expect(config.name).toBe(name);
      expect(config.ios?.bundleIdentifier).toBe(
        `com.futa.stamprally${idSuffix}`,
      );
      expect(config.android?.package).toBe(`com.futa.stamprally${idSuffix}`);
      expect(config.scheme).toBe(`stamp-rally${schemeSuffix}`);
      expect(config.slug).toBe(appJson.expo.slug);
      expect(config.extra?.eas).toEqual(appJson.expo.extra.eas);
      expect(config.ios?.usesAppleSignIn).toBe(true);
      expect(config.android?.adaptiveIcon).toEqual(
        appJson.expo.android.adaptiveIcon,
      );
      expect(config.plugins).toContain('expo-apple-authentication');
      expect(config.plugins).toContainEqual([
        'expo-dev-client',
        { addGeneratedScheme: developmentClient },
      ]);
      expect(config.plugins).toContainEqual([
        'react-native-nitro-google-signin',
        { iosUrlScheme: `com.googleusercontent.apps.${variant}-ios` },
      ]);
    },
  );

  it.each(['preview', 'prod', '', 'toString', '__proto__'])(
    'rejects unknown APP_VARIANT=%s',
    (variant) => {
      vi.stubEnv('APP_VARIANT', variant);
      expect(() => configure(context)).toThrow('Unknown APP_VARIANT');
    },
  );

  describe.each(['development', 'staging', 'production'] as const)(
    '%s required settings',
    (variant) => {
      it('allows config evaluation before EAS downloads environment variables', () => {
        vi.stubEnv('APP_VARIANT', variant);
        expect(() => configure(context)).not.toThrow();
      });

      it('accepts a configured remote build', () => {
        setRemoteEnvironment(variant);
        expect(() => validateRemoteEnvironment()).not.toThrow();
      });

      it.each(requiredKeys)('rejects missing or blank %s', (key) => {
        setRemoteEnvironment(variant);
        for (const value of [undefined, '', '  ']) {
          vi.stubEnv(key, value);
          expect(() => validateRemoteEnvironment()).toThrow(
            `${key} is required`,
          );
        }
      });
    },
  );

  it('takes the signing team from the environment without inheriting an old static team', () => {
    const oldContext = {
      ...context,
      config: {
        ...context.config,
        ios: { ...context.config.ios, appleTeamId: 'OLDTEAM123' },
      },
    };
    expect(configure(oldContext).ios?.appleTeamId).toBeUndefined();
    vi.stubEnv('APPLE_TEAM_ID', ' NEWTEAM123 ');
    expect(configure(oldContext).ios?.appleTeamId).toBe('NEWTEAM123');
  });
});

describe('Invitation link app associations', () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each(['local', 'development', 'staging', 'production'])(
    'associates only the configured host in %s',
    (variant) => {
      vi.stubEnv('APP_VARIANT', variant);
      vi.stubEnv(
        'EXPO_PUBLIC_INVITATION_ORIGIN',
        'https://' + variant + '.invite.example.com',
      );
      const config = configure(context);
      expect(config.ios?.associatedDomains).toEqual([
        'applinks:' + variant + '.invite.example.com',
      ]);
      expect(config.android?.intentFilters).toEqual([
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: variant + '.invite.example.com',
              path: '/',
            },
            {
              scheme: 'https',
              host: variant + '.invite.example.com',
              pathPrefix: '/invite/',
            },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ]);
      expect(config.extra?.appVariant).toBe(variant);
    },
  );
  it('keeps public sharing disabled until a domain is configured and verifies the flag', () => {
    setRemoteEnvironment('production');
    vi.stubEnv('EXPO_PUBLIC_INVITATION_ORIGIN', '');
    vi.stubEnv('EXPO_PUBLIC_INVITATION_LINKS_ENABLED', 'true');
    expect(() => validateRemoteEnvironment()).toThrow(
      'EXPO_PUBLIC_INVITATION_ORIGIN',
    );
    vi.stubEnv('EXPO_PUBLIC_INVITATION_LINKS_ENABLED', 'false');
    expect(() => validateRemoteEnvironment()).not.toThrow();
    expect(configure(context).ios?.associatedDomains).toEqual([]);
  });
  it.each([
    'http://example.com',
    'https://example.com/invite',
    'https://user@example.com',
  ])('rejects an invalid origin %s', (origin) => {
    vi.stubEnv('EXPO_PUBLIC_INVITATION_ORIGIN', origin);
    expect(() => configure(context)).toThrow('HTTPS origin');
  });
});
