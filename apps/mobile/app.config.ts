import type { ConfigContext, ExpoConfig } from 'expo/config';

const variants = {
  local: {
    suffix: '.local',
    scheme: 'stamp-rally-local',
    name: 'Stamp Rally Local',
  },
  development: {
    suffix: '.dev',
    scheme: 'stamp-rally-dev',
    name: 'Stamp Rally Dev',
  },
  staging: {
    suffix: '.stg',
    scheme: 'stamp-rally-stg',
    name: 'Stamp Rally Stg',
  },
  production: { suffix: '', scheme: 'stamp-rally', name: 'Stamp Rally' },
} as const;

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = process.env.APP_VARIANT ?? 'local';
  if (!Object.hasOwn(variants, variant)) {
    throw new Error(
      `Unknown APP_VARIANT: ${variant}. Use local, development, staging, or production.`,
    );
  }
  const app = variants[variant as keyof typeof variants];
  const identifier = `com.futa.stamprally${app.suffix}`;
  const isDevelopment = variant === 'local' || variant === 'development';
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

  const invitationOrigin = process.env.EXPO_PUBLIC_INVITATION_ORIGIN?.trim();
  let invitationHost: string | undefined;
  if (invitationOrigin) {
    const url = new URL(invitationOrigin);
    const localHttp =
      variant === 'local' &&
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
      throw new Error(
        'EXPO_PUBLIC_INVITATION_ORIGIN must be an HTTPS origin without a path (local builds also allow HTTP localhost or 127.0.0.1)',
      );
    // HTTP localhost is for Web testing; only HTTPS hosts get app associations.
    if (url.protocol === 'https:') invitationHost = url.hostname;
  }

  // EAS reads this config before fetching server-side environment variables.
  // Validate required values in the build hook / remote Metro launcher instead.

  return {
    ...config,
    name: app.name,
    slug: config.slug ?? 'stamp-rally',
    scheme: app.scheme,
    extra: { ...config.extra, appVariant: variant },
    ios: {
      ...config.ios,
      bundleIdentifier: identifier,
      associatedDomains: invitationHost ? ['applinks:' + invitationHost] : [],
      appleTeamId: process.env.APPLE_TEAM_ID?.trim() || undefined,
    },
    android: {
      ...config.android,
      package: identifier,
      intentFilters: invitationHost
        ? [
            {
              action: 'VIEW',
              autoVerify: true,
              data: [
                { scheme: 'https', host: invitationHost, path: '/' },
                {
                  scheme: 'https',
                  host: invitationHost,
                  pathPrefix: '/invite/',
                },
              ],
              category: ['BROWSABLE', 'DEFAULT'],
            },
          ]
        : [],
    },
    plugins: [
      ...(config.plugins ?? []),
      ['expo-dev-client', { addGeneratedScheme: isDevelopment }],
      ...(iosClientId
        ? [
            [
              'react-native-nitro-google-signin',
              { iosUrlScheme: iosClientId.split('.').reverse().join('.') },
            ] as [string, Record<string, string>],
          ]
        : []),
    ],
  };
};
