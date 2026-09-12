import { pathToFileURL } from 'node:url';

// No dependencies or dotenv loading: this also runs before EAS installs packages.
/** @param {Record<string, string | undefined>} environment */
export function validateRemoteEnvironment(environment = process.env) {
  const origin = environment.EXPO_PUBLIC_INVITATION_ORIGIN?.trim();
  if (origin) {
    const url = new URL(origin);
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.port ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error(
        'EXPO_PUBLIC_INVITATION_ORIGIN must be an HTTPS origin without a path',
      );
  }
  for (const key of [
    'EXPO_PUBLIC_API_URL',
    'EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID',
    'EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID',
  ]) {
    if (!environment[key]?.trim()) {
      throw new Error(
        `${key} is required. Set it in the corresponding EAS environment. See docs/build-setup.md.`,
      );
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  validateRemoteEnvironment();
}
