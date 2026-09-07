import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useData } from '../data/AppDataProvider';
import { localDate } from '../data/dates';
import {
  hasUnreadPhotos,
  newestFirst,
  selectPhotos,
  sortTrips,
} from '../data/selectors';

export function useTask() {
  const locked = useRef(false);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async (operation: () => Promise<unknown>) => {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    setError(null);
    try {
      await operation();
      return true;
    } catch (error) {
      if (mounted.current)
        setError(
          error instanceof Error
            ? error.message
            : '操作に失敗しました。もう一度お試しください。',
        );
      return false;
    } finally {
      locked.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);
  return { pending, error, run, clearError: () => setError(null) };
}

export function useToday() {
  const [today, setToday] = useState(() => localDate(new Date()));
  useEffect(() => {
    const update = () => setToday(localDate(new Date()));
    const timer = setInterval(update, 60_000);
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      listener.remove();
    };
  }, []);
  return today;
}

export function useTrips() {
  const { data, userId } = useData();
  const today = useToday();
  const memberTripIds = new Set(
    data.memberships.filter((m) => m.userId === userId).map((m) => m.tripId),
  );
  return {
    today,
    trips: sortTrips(
      data.trips.filter((t) => memberTripIds.has(t.id)),
      today,
    ),
  };
}

export function useTrip(tripId: string) {
  const { data, userId } = useData();
  const accessible = data.memberships.some(
    (m) => m.tripId === tripId && m.userId === userId,
  );
  return {
    trip: accessible ? data.trips.find((t) => t.id === tripId) : undefined,
    genres: data.genres
      .filter((g) => g.tripId === tripId)
      .map((g) => ({
        ...g,
        unread: hasUnreadPhotos(data, userId!, { genreId: g.id }),
      })),
    favorites: selectPhotos(data, { tripId }, true),
    members: data.users.filter((u) =>
      data.memberships.some((m) => m.tripId === tripId && m.userId === u.id),
    ),
  };
}

export function useGenre(genreId: string) {
  const { data, userId } = useData();
  const genre = data.genres.find((g) => g.id === genreId);
  const accessible = data.memberships.some(
    (m) => m.tripId === genre?.tripId && m.userId === userId,
  );
  return {
    genre: accessible ? genre : undefined,
    stamps: data.stamps
      .filter((s) => s.genreId === genreId)
      .map((s) => ({
        ...s,
        unread: hasUnreadPhotos(data, userId!, { stampId: s.id }),
        photoCount: selectPhotos(data, { stampId: s.id }).length,
      })),
  };
}

export function useStamp(stampId: string) {
  const { data } = useData();
  const stamp = data.stamps.find((s) => s.id === stampId);
  const { genre } = useGenre(stamp?.genreId ?? '');
  return {
    stamp: genre ? stamp : undefined,
    genre,
    photos: selectPhotos(data, { stampId }),
  };
}

export function usePhoto(postId: string) {
  const { data } = useData();
  const post = data.posts.find(
    (p) => p.id === postId && p.mediaType === 'IMAGE',
  );
  const { stamp } = useStamp(post?.stampId ?? '');
  return {
    photo:
      stamp && post
        ? {
            ...post,
            author: {
              id: post.author.id,
              name:
                data.users.find((u) => u.id === post.author.id)?.name ??
                post.author.name,
            },
          }
        : undefined,
    stamp,
  };
}

export function useNotifications() {
  const { data, userId } = useData();
  return data.notifications
    .filter((n) => n.recipientId === userId)
    .sort(newestFirst);
}
