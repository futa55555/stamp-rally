export function validateMediaUri(value: string) {
  const uri = value.trim();
  // Local files are intentionally supported by the in-memory adapter.
  if (!/^(https:\/\/|file:\/\/|content:\/\/).+/.test(uri))
    throw new Error('写真を選び直してください。');
  return uri;
}
