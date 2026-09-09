import { isInvitationToken } from './links';

type Storage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
};
type State = { ready: boolean; token: string | null; error: string | null };

// Serialize storage operations and fence late reads so logout/cancellation can
// never be undone by an older restore or write.
export class PendingInvitation {
  private state: State = { ready: false, token: null, error: null };
  private revision = 0;
  private queue = Promise.resolve();
  private listeners = new Set<() => void>();
  constructor(private readonly storage: Storage) {}
  snapshot = () => this.state;
  version = () => this.revision;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: State) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private write(work: () => Promise<void>) {
    const revision = this.revision;
    const next = this.queue.then(work);
    this.queue = next.catch(() => {});
    return next.catch((error: unknown) => {
      if (revision === this.revision)
        this.publish({
          ...this.state,
          error:
            '招待を保存できませんでした。元のリンクから再度開いてください。',
        });
      throw error;
    });
  }
  async restore() {
    const revision = this.revision;
    try {
      await this.queue;
      const raw = await this.storage.get();
      if (revision !== this.revision) return;
      const value: unknown = raw ? JSON.parse(raw) : null;
      const token =
        value &&
        typeof value === 'object' &&
        'token' in value &&
        'expiresAt' in value &&
        isInvitationToken(value.token) &&
        typeof value.expiresAt === 'number' &&
        value.expiresAt > Date.now()
          ? value.token
          : null;
      this.publish({ ready: true, token, error: null });
      if (!token && raw) await this.write(() => this.storage.clear());
    } catch {
      if (revision === this.revision)
        this.publish({
          ready: true,
          token: null,
          error:
            '招待を復元できませんでした。元のリンクから再度開いてください。',
        });
    }
  }
  capture(token: string) {
    if (!isInvitationToken(token)) return Promise.resolve();
    this.revision++;
    this.publish({ ready: true, token, error: null });
    const value = JSON.stringify({
      token,
      expiresAt: Date.now() + 7 * 86400000,
    });
    return this.write(() => this.storage.set(value));
  }
  clear() {
    this.revision++;
    this.publish({ ready: true, token: null, error: null });
    return this.write(() => this.storage.clear());
  }
}
