import axios, {
  CanceledError,
  type AxiosInstance,
  type AxiosRequestConfig,
} from 'axios';
import type { User } from '../../auth/model/types';

import { ApiError, apiError } from '../../../shared/api/errors';
type Tokens = { accessToken: string; refreshToken: string };
export type TokenStorage = {
  get(): Promise<string | null>;
  set(value: string): Promise<void>;
  clear(): Promise<void>;
};
export type SessionState = {
  status: 'loading' | 'signedOut' | 'signedIn' | 'error';
  user: User | null;
  error: string | null;
};

// No access token leaves this in-memory client. Epochs also fence results from
// native sign-in, SecureStore and transports that do not honor cancellation.
export class SessionClient {
  private accessToken: string | null = null;
  private epoch = 0;
  private controller = new AbortController();
  private refreshFlight: Promise<void> | null = null;
  private restoreFlight: Promise<void> | null = null;
  private storageQueue: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private state: SessionState = { status: 'loading', user: null, error: null };
  readonly http: AxiosInstance;

  constructor(
    baseURL: string,
    private readonly storage: TokenStorage,
    private readonly clearCache: () => void,
    http?: AxiosInstance,
  ) {
    this.http = http ?? axios.create({ baseURL, timeout: 20000 });
  }
  snapshot = () => this.state;
  sessionGuard() {
    const epoch = this.epoch;
    return () => this.check(epoch);
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: SessionState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private check(epoch: number) {
    if (epoch !== this.epoch) throw new CanceledError('Session changed');
  }
  private store(work: () => Promise<void>) {
    const next = this.storageQueue.then(work);
    this.storageQueue = next.catch(() => {});
    return next;
  }
  private async accept(tokens: Tokens, epoch: number) {
    this.check(epoch);
    await this.store(() => {
      this.check(epoch);
      return this.storage.set(tokens.refreshToken);
    });
    this.check(epoch);
    this.accessToken = tokens.accessToken;
  }
  private reset() {
    this.epoch++;
    this.controller.abort();
    this.controller = new AbortController();
    this.accessToken = null;
    this.refreshFlight = null;
    this.restoreFlight = null;
    this.clearCache();
    this.publish({ status: 'signedOut', user: null, error: null });
    return this.store(() => this.storage.clear());
  }
  private refresh(epoch: number): Promise<void> {
    this.check(epoch);
    if (this.refreshFlight) return this.refreshFlight;
    const flight = (async () => {
      await this.storageQueue;
      this.check(epoch);
      const refreshToken = await this.storage.get();
      this.check(epoch);
      if (!refreshToken) throw new ApiError('ログインし直してください。', 401);
      const { data } = await this.http.post<Tokens>(
        '/auth/refresh',
        { refreshToken },
        { signal: this.controller.signal },
      );
      await this.accept(data, epoch);
    })()
      .catch(async (error: unknown) => {
        const normalized = apiError(error);
        if (
          epoch === this.epoch &&
          normalized instanceof ApiError &&
          normalized.status === 401
        )
          await this.reset();
        throw normalized;
      })
      .finally(() => {
        if (this.refreshFlight === flight) this.refreshFlight = null;
      });
    this.refreshFlight = flight;
    return flight;
  }
  restore = (): Promise<void> => {
    if (this.restoreFlight) return this.restoreFlight;
    const epoch = this.epoch;
    this.publish({ status: 'loading', user: null, error: null });
    const flight = (async () => {
      try {
        await this.refresh(epoch);
        const user = await this.request<User>({ url: '/users/me' });
        this.check(epoch);
        this.publish({ status: 'signedIn', user, error: null });
      } catch (error) {
        if (epoch !== this.epoch || axios.isCancel(error)) return;
        this.publish({
          status: 'error',
          user: null,
          error: apiError(error).message,
        });
      }
    })().finally(() => {
      if (this.restoreFlight === flight) this.restoreFlight = null;
    });
    this.restoreFlight = flight;
    return flight;
  };
  async signIn(
    credentials: () => Promise<{
      provider: 'google' | 'apple';
      body: Record<string, string>;
    } | null>,
  ) {
    const epoch = this.epoch;
    const identity = await credentials();
    this.check(epoch);
    if (!identity) return;
    try {
      const { data } = await this.http.post<Tokens>(
        `/auth/${identity.provider}`,
        identity.body,
        { signal: this.controller.signal },
      );
      await this.accept(data, epoch);
      // If profile loading fails after a successful login, keep the refresh token
      // and expose a retryable restoration screen instead of losing the session.
      this.publish({ status: 'loading', user: null, error: null });
      const user = await this.request<User>({ url: '/users/me' });
      this.check(epoch);
      this.publish({ status: 'signedIn', user, error: null });
    } catch (error) {
      if (epoch === this.epoch && this.accessToken)
        this.publish({
          status: 'error',
          user: null,
          error: apiError(error).message,
        });
      throw apiError(error);
    }
  }
  signOut = async () => {
    const token = this.accessToken;
    const cleared = this.reset();
    if (token)
      void this.http
        .post('/auth/logout', undefined, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 5000,
        })
        .catch(() => {});
    await cleared;
  };
  async updateName(name: string) {
    const epoch = this.epoch;
    const user = await this.request<User>({
      method: 'PATCH',
      url: '/users/me',
      data: { name },
    });
    this.check(epoch);
    this.publish({ status: 'signedIn', user, error: null });
    return user;
  }
  async request<T>(config: AxiosRequestConfig): Promise<T> {
    const epoch = this.epoch;
    const controller = new AbortController();
    const sessionSignal = this.controller.signal;
    const abort = () => controller.abort();
    sessionSignal.addEventListener('abort', abort);
    config.signal?.addEventListener?.('abort', abort);
    if (sessionSignal.aborted || config.signal?.aborted) abort();
    const send = async () => {
      this.check(epoch);
      const token = this.accessToken;
      try {
        const response = await this.http.request<T>({
          ...config,
          signal: controller.signal,
          headers: { ...config.headers, Authorization: `Bearer ${token}` },
        });
        this.check(epoch);
        return response.data;
      } catch (error) {
        this.check(epoch);
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          // Late 401s from the old token reuse the refresh already completed.
          if (token === this.accessToken) await this.refresh(epoch);
          this.check(epoch);
          const response = await this.http.request<T>({
            ...config,
            signal: controller.signal,
            headers: {
              ...config.headers,
              Authorization: `Bearer ${this.accessToken}`,
            },
          });
          this.check(epoch);
          return response.data;
        }
        throw error;
      }
    };
    try {
      return await send();
    } catch (error) {
      throw apiError(error);
    } finally {
      sessionSignal.removeEventListener('abort', abort);
      config.signal?.removeEventListener?.('abort', abort);
    }
  }
}
