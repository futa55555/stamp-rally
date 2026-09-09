import { readFile } from 'node:fs/promises';

// Copy each environment's static JSON verbatim; identifiers are not env vars.
export async function associationAssets(mode: string) {
  if (!['localhost', 'development', 'staging', 'production'].includes(mode))
    throw new Error(
      'Use localhost, development, staging, or production mode for web builds',
    );
  // Vite reserves "local" for the .env.local suffix, so the local mode is "localhost".
  const environment = mode === 'localhost' ? 'local' : mode;
  const names = ['apple-app-site-association', 'assetlinks.json'];
  return Object.fromEntries(
    await Promise.all(
      names.map(async (name) => {
        const source = await readFile(
          new URL(`../associations/${environment}/${name}`, import.meta.url),
          'utf8',
        );
        JSON.parse(source);
        return [`.well-known/${name}`, source] as const;
      }),
    ),
  );
}
