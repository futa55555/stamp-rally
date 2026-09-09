import { Directory, File, Paths } from 'expo-file-system';

const root = (userId: string) =>
  new Directory(Paths.cache, 'trip-cover-drafts', encodeURIComponent(userId));

export async function retainCoverDraft(
  userId: string,
  id: string,
  uri: string,
) {
  const directory = root(userId);
  directory.create({ intermediates: true, idempotent: true });
  const file = new File(directory, `${id}.png`);
  try {
    await new File(uri).copy(file);
  } catch (error) {
    if (file.exists) file.delete();
    throw error;
  }
  return file.uri;
}

export function removeCoverDraft(userId: string, uri: string) {
  if (!uri.startsWith(`${root(userId).uri.replace(/\/$/, '')}/`)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* The OS can also evict abandoned cover drafts from its cache. */
  }
}
