export const newestFirst = <T extends { createdAt: string; id: string }>(
  a: T,
  b: T,
) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
