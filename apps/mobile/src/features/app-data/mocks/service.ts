import { validateMediaUri } from '../../../shared/lib/media';
import { validateName } from '../../auth/model/validation';
import { MAX_POST_PHOTOS } from '../../photos/model/inputs';
import type { Post } from '../../photos/model/types';
import {
  requireCategoryAccess,
  requireStampAccess,
  requireTripAccess,
} from '../../trips/model/access';
import type { Category, Stamp, Trip } from '../../trips/model/types';
import {
  validateNamedInput,
  validateTripInput,
  validateDomainName,
  normalizeLocations,
} from '../../trips/model/validation';
import { withProgress } from '../../trips/model/progress';
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
    activityPresets: trip.activityPresets ?? [],
    customActivities: trip.customActivities ?? [],
  }));
  const trash = new Map<
    string,
    {
      post: Post;
      deletedAt: number;
      reads: Record<string, string[]>;
      notifications: typeof data.notifications;
    }
  >();
  const tripRequests = new Map<string, string>();
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
  const membership = (
    userId: string,
    tripId: string,
    categoryIds: string[],
  ) => {
    requireTripAccess(data, userId, tripId);
    if (
      !categoryIds.length ||
      new Set(categoryIds).size !== categoryIds.length ||
      categoryIds.some(
        (id) =>
          !data.categories.some((g) => g.id === id && g.tripId === tripId),
      )
    )
      throw new Error('同じ旅行のカテゴリーを1つ以上選んでください。');
    return data.categories
      .filter((g) => categoryIds.includes(g.id))
      .sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      )
      .map((g) => g.id);
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
      const requestKey = input.clientRequestId
        ? JSON.stringify([userId, input.clientRequestId])
        : null;
      const previousId = requestKey ? tripRequests.get(requestKey) : undefined;
      if (previousId) return copy(find(data.trips, previousId));
      const values = validateTripInput(input);
      const activityPresets = normalizeLocations(input.activityPresets).map(
        validateDomainName,
      );
      const customActivities = normalizeLocations(input.customActivities).map(
        validateDomainName,
      );
      const selected = new Map<string, Set<string>>();
      for (const category of input.selectedCategories ?? []) {
        const name = validateDomainName(category.name);
        const stamps = selected.get(name) ?? new Set<string>();
        for (const stamp of category.stamps)
          stamps.add(validateDomainName(stamp.title));
        if (stamps.size) selected.set(name, stamps);
      }
      const now = new Date().toISOString();
      const trip: Trip = {
        coverImageUrl: null,
        ...values,
        activityPresets,
        customActivities,
        id: id(),
        createdById: userId,
        createdAt: now,
        updatedAt: now,
        totalCategoryCount: 0,
        completedCategoryCount: 0,
        isCompleted: false,
      };
      const categories: Category[] = [];
      const stamps: Stamp[] = [];
      for (const [name, titles] of selected) {
        const category: Category = {
          id: id(),
          tripId: trip.id,
          name,
          description: '',
          createdAt: now,
          updatedAt: now,
          totalStampCount: titles.size,
          completedStampCount: 0,
          isCompleted: false,
          hasUnreadPhotos: false,
        };
        categories.push(category);
        for (const title of titles) {
          const shared = stamps.find((stamp) => stamp.name === title);
          if (shared) {
            shared.categoryIds.push(category.id);
            continue;
          }
          stamps.push({
            id: id(),
            tripId: trip.id,
            categoryIds: [category.id],
            name: title,
            description: '',
            createdAt: now,
            updatedAt: now,
            isCompleted: false,
            hasUnreadPhotos: false,
            photoCount: 0,
          });
        }
      }
      data = withProgress({
        ...data,
        trips: [...data.trips, trip],
        categories: [...data.categories, ...categories],
        stamps: [...data.stamps, ...stamps],
        memberships: [...data.memberships, { tripId: trip.id, userId }],
      });
      if (requestKey) tripRequests.set(requestKey, trip.id);
      return copy(find(data.trips, trip.id));
    },
    async updateTrip(userId, tripId, input) {
      await delay();
      const current = requireTripAccess(data, userId, tripId);
      const trip = {
        ...current,
        ...validateTripInput(input),
        ...(input.coverAssetId !== undefined
          ? {
              coverImageUrl: input.coverAssetId
                ? `https://media.example.test/covers/${input.coverAssetId}.webp`
                : null,
            }
          : {}),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'tripSaved', trip });
      return copy(trip);
    },
    async createCategory(userId, input) {
      await delay();
      requireTripAccess(data, userId, input.tripId);
      const values = validateNamedInput(input);
      const now = new Date().toISOString();
      const category: Category = {
        ...values,
        tripId: input.tripId,
        id: id(),
        createdAt: now,
        updatedAt: now,
        totalStampCount: 0,
        completedStampCount: 0,
        isCompleted: false,
        hasUnreadPhotos: false,
      };
      commit({ type: 'categorySaved', category });
      return copy(category);
    },
    async updateCategory(userId, categoryId, input) {
      await delay();
      const current = requireCategoryAccess(data, userId, categoryId);
      const category = {
        ...current,
        ...validateNamedInput(input),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'categorySaved', category });
      return copy(category);
    },
    async createStamp(userId, input) {
      await delay();
      const categoryIds = membership(userId, input.tripId, input.categoryIds);
      const values = validateNamedInput(input);
      const now = new Date().toISOString();
      const stamp: Stamp = {
        ...values,
        tripId: input.tripId,
        categoryIds,
        id: id(),
        createdAt: now,
        updatedAt: now,
        isCompleted: false,
        hasUnreadPhotos: false,
        photoCount: 0,
      };
      commit({ type: 'stampSaved', stamp });
      return copy(stamp);
    },
    async updateStamp(userId, stampId, input) {
      await delay();
      const { stamp: current } = requireStampAccess(data, userId, stampId);
      const categoryIds = membership(
        userId,
        current.tripId,
        input.categoryIds ?? current.categoryIds,
      );
      const stamp = {
        ...current,
        categoryIds,
        ...validateNamedInput(input),
        updatedAt: new Date().toISOString(),
      };
      commit({ type: 'stampSaved', stamp });
      return copy(stamp);
    },
    async createPosts(userId, input) {
      await delay();
      const user = find(data.users, userId);
      const { stamp } = requireStampAccess(data, userId, input.stampId);
      if (!input.mediaUrls.length || input.mediaUrls.length > MAX_POST_PHOTOS)
        throw new Error(`写真は1〜${MAX_POST_PHOTOS}枚選んでください。`);
      const urls = input.mediaUrls.map(validateMediaUri);
      const now = new Date().toISOString();
      const posts: Post[] = urls.map((mediaUrl) => ({
        id: id(),
        stampId: stamp.id,
        categoryIds: [...stamp.categoryIds],
        tripId: stamp.tripId,
        author: { id: user.id, name: user.name },
        mediaType: 'IMAGE',
        readAt: null,
        mediaUrl,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      }));
      commit({ type: 'postsCreated', posts });
      return copy(posts);
    },
    async restorePost(userId, postId) {
      await delay();
      find(data.users, userId);
      const entry = trash.get(postId);
      const post = entry?.post ?? find(data.posts, postId);
      requireStampAccess(data, userId, post.stampId);
      if (!entry) return copy(post);
      if (Date.now() - entry.deletedAt >= 30 * 86400000)
        throw new Error('復元できる30日間を過ぎています。');
      commit({ type: 'postsCreated', posts: [entry.post] });
      for (const [reader, ids] of Object.entries(entry.reads))
        if (ids.includes(postId))
          data.readPhotoIds[reader] = [
            ...new Set([...(data.readPhotoIds[reader] ?? []), postId]),
          ];
      data.notifications.push(...entry.notifications);
      trash.delete(postId);
      return copy(post);
    },
    async deletePost(userId, postId) {
      await delay();
      find(data.users, userId);
      const existing = trash.get(postId);
      const post = existing?.post ?? find(data.posts, postId);
      requireTripAccess(data, userId, post.tripId);
      if (existing) return;
      trash.set(postId, {
        post: copy(post),
        deletedAt: Date.now(),
        reads: copy(data.readPhotoIds),
        notifications: data.notifications.filter(
          (n) =>
            (n.target.type === 'photo' || n.target.type === 'video') &&
            n.target.postId === postId,
        ),
      });
      commit({ type: 'postDeleted', postId });
    },
  };
}
