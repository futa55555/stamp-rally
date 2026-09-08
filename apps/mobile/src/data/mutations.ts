import type { AppData, Genre, Post, Stamp, Trip } from './types';

export const MAX_POST_PHOTOS = 10;
export type TripInput = Pick<
  Trip,
  'name' | 'startDate' | 'endDate' | 'coverImageUrl'
>;
export type NamedInput = Pick<Genre, 'name' | 'description'>;
export type CreateGenreInput = NamedInput & { tripId: string };
export type CreateStampInput = NamedInput & { genreId: string };
export type CreatePostsInput = { stampId: string; mediaUrls: string[] };
export type DomainChange =
  | { type: 'tripSaved'; trip: Trip; memberId?: string }
  | { type: 'genreSaved'; genre: Genre }
  | { type: 'stampSaved'; stamp: Stamp }
  | { type: 'postsCreated'; posts: Post[] };

export function validateDomainName(value: string) {
  const name = value.trim();
  if (!name || Array.from(name).length > 100)
    throw new Error('名前は1〜100文字で入力してください。');
  return name;
}

export function validateNamedInput(input: NamedInput): NamedInput {
  const name = validateDomainName(input.name);
  if (Array.from(input.description).length > 2000)
    throw new Error('説明は2,000文字以内で入力してください。');
  return { name, description: input.description };
}

export function validateMediaUri(value: string) {
  const uri = value.trim();
  // Local files are intentionally supported by the in-memory adapter.
  if (!/^(https:\/\/|file:\/\/|content:\/\/).+/.test(uri))
    throw new Error('写真を選び直してください。');
  return uri;
}

export function validateTripInput(input: TripInput): TripInput {
  const name = validateDomainName(input.name);
  for (const value of [input.startDate, input.endDate]) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      value.startsWith('0000-') ||
      !Number.isFinite(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    )
      throw new Error('日付を正しく選択してください。');
  }
  if (input.startDate > input.endDate)
    throw new Error('終了日は開始日以降にしてください。');
  return {
    ...input,
    name,
    coverImageUrl:
      input.coverImageUrl === null
        ? null
        : validateMediaUri(input.coverImageUrl),
  };
}

export function requireTripAccess(
  data: AppData,
  userId: string,
  tripId: string,
) {
  const trip = data.trips.find((item) => item.id === tripId);
  if (
    !trip ||
    !data.memberships.some((m) => m.tripId === tripId && m.userId === userId)
  )
    throw new Error('旅行が見つからないか、参加していません。');
  return trip;
}

export function requireGenreAccess(
  data: AppData,
  userId: string,
  genreId: string,
) {
  const genre = data.genres.find((item) => item.id === genreId);
  if (!genre) throw new Error('ジャンルが見つかりません。');
  requireTripAccess(data, userId, genre.tripId);
  return genre;
}

export function requireStampAccess(
  data: AppData,
  userId: string,
  stampId: string,
) {
  const stamp = data.stamps.find((item) => item.id === stampId);
  if (!stamp) throw new Error('スタンプが見つかりません。');
  const genre = requireGenreAccess(data, userId, stamp.genreId);
  return { stamp, genre };
}

export function withProgress(data: AppData): AppData {
  const posted = new Set(data.posts.map((p) => p.stampId));
  const stamps = data.stamps.map((s) => ({
    ...s,
    isCompleted: posted.has(s.id),
  }));
  const genres = data.genres.map((g) => {
    const children = stamps.filter((s) => s.genreId === g.id);
    const completedStampCount = children.filter((s) => s.isCompleted).length;
    return {
      ...g,
      totalStampCount: children.length,
      completedStampCount,
      isCompleted:
        children.length > 0 && completedStampCount === children.length,
    };
  });
  const trips = data.trips.map((t) => {
    const children = genres.filter((g) => g.tripId === t.id);
    const completedGenreCount = children.filter((g) => g.isCompleted).length;
    return {
      ...t,
      totalGenreCount: children.length,
      completedGenreCount,
      isCompleted:
        children.length > 0 && completedGenreCount === children.length,
    };
  });
  return { ...data, trips, genres, stamps };
}

const upsert = <T extends { id: string }>(items: T[], item: T): T[] =>
  items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];

// The adapter and React store apply exactly the same domain changes.
export function applyDomainChange(
  data: AppData,
  change: DomainChange,
): AppData {
  switch (change.type) {
    case 'tripSaved':
      return withProgress({
        ...data,
        trips: upsert(data.trips, change.trip),
        memberships:
          change.memberId &&
          !data.memberships.some(
            (m) => m.tripId === change.trip.id && m.userId === change.memberId,
          )
            ? [
                ...data.memberships,
                { tripId: change.trip.id, userId: change.memberId },
              ]
            : data.memberships,
      });
    case 'genreSaved':
      return withProgress({
        ...data,
        genres: upsert(data.genres, change.genre),
      });
    case 'stampSaved':
      return withProgress({
        ...data,
        stamps: upsert(data.stamps, change.stamp),
      });
    case 'postsCreated':
      return withProgress({
        ...data,
        posts: change.posts.reduce(
          (items, post) => upsert(items, post),
          data.posts,
        ),
      });
  }
}
