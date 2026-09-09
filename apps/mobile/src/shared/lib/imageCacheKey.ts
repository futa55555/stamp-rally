const signatureParameters = new Set([
  'x-amz-algorithm',
  'x-amz-credential',
  'x-amz-date',
  'x-amz-expires',
  'x-amz-security-token',
  'x-amz-signature',
  'x-amz-signedheaders',
  'x-amz-content-sha256',
]);

export function imageCacheKey(url: string): string {
  if (!/^https?:\/\//i.test(url)) return url;
  try {
    const parsed = new URL(url);
    const parameters = [...parsed.searchParams.keys()];
    if (!parameters.some((name) => name.toLowerCase() === 'x-amz-signature'))
      return url;
    for (const name of parameters) {
      if (signatureParameters.has(name.toLowerCase()))
        parsed.searchParams.delete(name);
    }
    // Keep the host, versioned object path, size and any image transformation
    // parameters. Only the temporary authorization is excluded from identity.
    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return url;
  }
}
