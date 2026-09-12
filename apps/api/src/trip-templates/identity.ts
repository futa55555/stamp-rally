export const categoryExclusion = (key: string) => `category:${key}`;
export const membershipExclusion = (categoryKey: string, stampKey: string) =>
  `membership:${JSON.stringify([categoryKey, stampKey])}`;
