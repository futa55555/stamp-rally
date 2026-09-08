import { validateMediaUri } from '../../../shared/lib/media';
import { validateName } from '../../auth/model/validation';
import { MAX_POST_PHOTOS } from '../../photos/model/inputs';
import type { Post } from '../../photos/model/types';
import {
  requireGenreAccess,
  requireStampAccess,
  requireTripAccess,
} from '../../trips/model/access';
import type { Genre, Stamp, Trip } from '../../trips/model/types';
import {
  validateNamedInput,
  validateTripInput,
} from '../../trips/model/validation';
import type { DataService } from '../api/DataService';
import type { DomainChange } from '../model/changes';
import { applyDomainChange } from '../model/changes';
import { DEMO_USER_ID, createDemoData } from './fixtures';

export function createMockService(
  initial = createDemoData(),
  delayMs = 180,
): DataService {
  // The API-shaped data contains only JSON values; this also works in Hermes.
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
  let data = copy(initial);
  data.trips = data.trips.map((trip) => ({
    ...trip,
    locations: trip.locations ?? [],
  }));
  let sequence = 0;
  const id = () =>
    `mock-${Date.now().toString(36)}-${String(++sequence).padStart(6, '0')}`;
  const commit = (change: DomainChange) => {
    data = applyDomainChange(data, change);
  };
  const delay = () =>
    new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  const find = <T extends { id: string }>(items: T[], id: string): T => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new Error('対象のデータが見つかりませんでした。');
    return item;
  };
  return {
    async load() {
      await delay();
      return copy(data);
    },
    async signIn(_provider) {
      await delay();
      return DEMO_USER_ID;
    },
    async signOut() {
      await delay();
    },
    async setFavorite(postId, isFavorite) {
      await delay();
      const post = find(data.posts, postId);
      post.isFavorite = isFavorite;
      post.updatedAt = new Date().toISOString();
      return { ...post };
    },
    async markPhotoRead(userId, postId) {
      await delay();
      find(data.users, userId);
      const post = find(data.posts, postId);
      if (post.mediaType !== 'IMAGE')
        throw new Error('この投稿は写真ではありません。');
      data.readPhotoIds[userId] = [
        ...new Set([...(data.readPhotoIds[userId] ?? []), postId]),
      ];
    },
    async markNotificationRead(id) {
      await delay();
      const notification = find(data.notifications, id);
      notification.readAt ??= new Date().toISOString();
      return { ...notification };
    },
    async updateName(userId, name) {
      await delay();
      const user = find(data.users, userId);
      user.name = validateName(name, userId, data.users);
      user.status = 'ACTIVE';
      return { ...user };
    },
    async createTrip(userId, input) {
      await delay();
      find(data.users, userId);
      const values = validateTripInput(input);
      const now = new Date().toISOString();
      const trip: Trip = {
        ...values,
        id: id(),
        createdById: userId,
        createdAt: now,
        updatedAt: now,
        totalGenreCount: 0,
        completedGenreCount: 0,
        isCompleted: false,
      };
      commit({ type: 'tripSaved', trip, memberId: userId });
      return copy(trip);
    },
    async updateTrip(userId, tripId, input) {
      await delay();
      const current = requireTripAccess(data, userId, tripId);
      const trip = {
        ...current,
        ...validateTripInput(input),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'tripSaved', trip });
      return copy(trip);
    },
    async createGenre(userId, input) {
      await delay();
      requireTripAccess(data, userId, input.tripId);
      const values = validateNamedInput(input);
      const now = new Date().toISOString();
      const genre: Genre = {
        ...values,
        tripId: input.tripId,
        id: id(),
        createdAt: now,
        updatedAt: now,
        totalStampCount: 0,
        completedStampCount: 0,
        isCompleted: false,
      };
      commit({ type: 'genreSaved', genre });
      return copy(genre);
    },
    async updateGenre(userId, genreId, input) {
      await delay();
      const current = requireGenreAccess(data, userId, genreId);
      const genre = {
        ...current,
        ...validateNamedInput(input),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'genreSaved', genre });
      return copy(genre);
    },
    async createStamp(userId, input) {
      await delay();
      requireGenreAccess(data, userId, input.genreId);
      const values = validateNamedInput(input);
      const now = new Date().toISOString();
      const stamp: Stamp = {
        ...values,
        genreId: input.genreId,
        id: id(),
        createdAt: now,
        updatedAt: now,
        isCompleted: false,
      };
      commit({ type: 'stampSaved', stamp });
      return copy(stamp);
    },
    async updateStamp(userId, stampId, input) {
      await delay();
      const { stamp: current } = requireStampAccess(data, userId, stampId);
      const stamp = {
        ...current,
        ...validateNamedInput(input),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'stampSaved', stamp });
      return copy(stamp);
    },
    async createPosts(userId, input) {
      await delay();
      const user = find(data.users, userId);
      const { stamp, genre } = requireStampAccess(data, userId, input.stampId);
      if (!input.mediaUrls.length || input.mediaUrls.length > MAX_POST_PHOTOS)
        throw new Error(`写真は1〜${MAX_POST_PHOTOS}枚選んでください。`);
      const urls = input.mediaUrls.map(validateMediaUri);
      const now = new Date().toISOString();
      const posts: Post[] = urls.map((mediaUrl) => ({
        id: id(),
        stampId: stamp.id,
        genreId: genre.id,
        tripId: genre.tripId,
        author: { id: user.id, name: user.name },
        mediaType: 'IMAGE',
        mediaUrl,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      }));
      commit({ type: 'postsCreated', posts });
      return copy(posts);
    },
    async deletePost(userId, postId) {
      await delay();
      find(data.users, userId);
      const post = find(data.posts, postId);
      requireTripAccess(data, userId, post.tripId);
      commit({ type: 'postDeleted', postId });
    },
  };
}
