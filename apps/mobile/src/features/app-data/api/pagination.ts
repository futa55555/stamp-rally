import type { SessionClient } from './SessionClient';
export type Page<T> = { items: T[]; nextCursor: string | null };
export type Filters = Record<string, string | boolean | number | undefined>;
export async function allPages<T>(
  client: Pick<SessionClient, 'request'>,
  path: string,
  filters: Filters,
  signal?: AbortSignal,
): Promise<T[]> {
  const items: T[] = [];
  const cursors = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await client.request<Page<T>>({
      url: path,
      params: { ...filters, limit: 100, cursor },
      signal,
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (cursor && cursors.has(cursor))
      throw new Error(
        'ページの取得を続けられませんでした。再試行してください。',
      );
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return items;
}
