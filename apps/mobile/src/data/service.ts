import { createDemoData, DEMO_USER_ID } from "./fixtures";
import { validateName } from "./selectors";
import type {
  AppData,
  AppNotification,
  LoginProvider,
  Post,
  User,
} from "./types";

// Replace this adapter to connect the UI to the API. Screens never read fixtures.
export interface DataService {
  load(): Promise<AppData>;
  signIn(provider: LoginProvider): Promise<string>;
  signOut(): Promise<void>;
  setFavorite(postId: string, isFavorite: boolean): Promise<Post>;
  markPhotoRead(userId: string, postId: string): Promise<void>;
  markNotificationRead(id: string): Promise<AppNotification>;
  updateName(userId: string, name: string): Promise<User>;
}

export function createMockService(
  initial = createDemoData(),
  delayMs = 180,
): DataService {
  // The API-shaped data contains only JSON values; this also works in Hermes.
  const copy = (value: AppData): AppData => JSON.parse(JSON.stringify(value));
  const data = copy(initial);
  const delay = () =>
    new Promise<void>((resolve) => setTimeout(resolve, delayMs));
  const find = <T extends { id: string }>(items: T[], id: string): T => {
    const item = items.find((candidate) => candidate.id === id);
    if (!item) throw new Error("対象のデータが見つかりませんでした。");
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
      if (post.mediaType !== "IMAGE")
        throw new Error("この投稿は写真ではありません。");
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
      user.status = "ACTIVE";
      return { ...user };
    },
  };
}
