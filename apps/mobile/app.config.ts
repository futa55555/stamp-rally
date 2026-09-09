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

  // EAS reads this config before fetching server-side environment variables.
  // Validate required values in the build hook / remote Metro launcher instead.

  return {
    ...config,
    name: app.name,
    slug: config.slug ?? 'stamp-rally',
    scheme: app.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: identifier,
      appleTeamId: process.env.APPLE_TEAM_ID?.trim() || undefined,
    },
    android: {
      ...config.android,
      package: identifier,
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
