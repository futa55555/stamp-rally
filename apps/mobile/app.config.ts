import type { ConfigContext, ExpoConfig } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  return {
    ...config,
    name: config.name ?? 'Stamp Rally',
    slug: config.slug ?? 'stamp-rally',
    plugins: [
      ...(config.plugins ?? []),
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
