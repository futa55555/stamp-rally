import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PgBoss } from 'pg-boss';
import { ObjectStorageService } from '../storage/object-storage.service.js';

export const MEDIA_PROCESS_QUEUE = 'media-process';
export const MEDIA_CLEANUP_QUEUE = 'media-cleanup';
export const MEDIA_RECONCILE_QUEUE = 'media-reconcile';
export const MEDIA_LEGACY_QUEUE = 'media-legacy';
export interface ProcessJob {
  postId: string;
  version: number;
}
export interface CleanupJob {
  keys: string[];
  multipart?: { key: string; uploadId: string };
}
export interface MediaJobHandlers {
  process(postId: string, version: number): Promise<void>;
  cleanup(): Promise<void>;
  migrateLegacy(postId: string): Promise<void>;
}

@Injectable()
export class MediaQueue implements OnModuleDestroy {
  private readonly logger = new Logger(MediaQueue.name);
  private boss?: PgBoss;
  private starting?: Promise<PgBoss>;
  private codecTail: Promise<void> = Promise.resolve();
  constructor(
    private readonly config: ConfigService,
    private readonly storage: ObjectStorageService,
  ) {}

  private async connection(): Promise<PgBoss> {
    this.starting ??= this.start();
    try {
      return await this.starting;
    } catch (error) {
      this.starting = undefined;
      throw error;
    }
  }

  private async start(): Promise<PgBoss> {
    const boss = new PgBoss({
      connectionString: this.config.getOrThrow<string>('DATABASE_URL'),
      schema: 'pgboss',
    });
    boss.on('error', (error) => this.logger.error(error.message));
    try {
      await boss.start();
      for (const name of [MEDIA_PROCESS_QUEUE, MEDIA_LEGACY_QUEUE]) {
        await boss.createQueue(name, {
          retryLimit: 3,
          retryDelay: 30,
          retryBackoff: true,
          // At most one job from each codec queue is active locally. A job may
          // wait for the other queue's bounded two-hour task before running.
          expireInSeconds: 14400,
          retentionSeconds: 7 * 86400,
        });
      }
      for (const name of [MEDIA_CLEANUP_QUEUE, MEDIA_RECONCILE_QUEUE]) {
        await boss.createQueue(name, {
          retryLimit: 10,
          retryDelay: 60,
          retryBackoff: true,
          expireInSeconds: 900,
        });
      }
      this.boss = boss;
      return boss;
    } catch (error) {
      await boss.stop().catch(() => undefined);
      throw error;
    }
  }

  async enqueueProcess(postId: string, version: number): Promise<void> {
    const boss = await this.connection();
    await boss.send(
      MEDIA_PROCESS_QUEUE,
      { postId, version },
      { singletonKey: `${postId}:${version}`, singletonSeconds: 60 },
    );
  }

  async enqueueCleanup(
    keys: string[],
    multipart?: CleanupJob['multipart'],
  ): Promise<void> {
    const boss = await this.connection();
    await boss.send(MEDIA_CLEANUP_QUEUE, { keys, multipart });
  }

  async enqueueLegacy(postId: string): Promise<void> {
    const boss = await this.connection();
    await boss.send(
      MEDIA_LEGACY_QUEUE,
      { postId },
      { singletonKey: postId, singletonSeconds: 60 },
    );
  }

  async startWorkers(handlers: MediaJobHandlers): Promise<void> {
    const boss = await this.connection();
    // Serial per process: native codecs are CPU and memory intensive. Scale worker replicas.
    await boss.work<ProcessJob>(
      MEDIA_PROCESS_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs)
          await this.withCodecSlot(() =>
            handlers.process(job.data.postId, job.data.version),
          );
      },
    );
    await boss.work<{ postId: string }>(
      MEDIA_LEGACY_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs)
          await this.withCodecSlot(() =>
            handlers.migrateLegacy(job.data.postId),
          );
      },
    );
    await boss.work<CleanupJob>(
      MEDIA_CLEANUP_QUEUE,
      { batchSize: 1 },
      async (jobs) => {
        for (const { data } of jobs) {
          if (data.multipart)
            await this.storage.abortMultipart(
              data.multipart.key,
              data.multipart.uploadId,
            );
          await this.storage.delete(data.keys);
        }
      },
    );
    await boss.work(MEDIA_RECONCILE_QUEUE, { batchSize: 1 }, async () =>
      handlers.cleanup(),
    );
    await boss.schedule(MEDIA_RECONCILE_QUEUE, '* * * * *');
    await handlers.cleanup();
  }

  private async withCodecSlot(operation: () => Promise<void>): Promise<void> {
    const previous = this.codecTail;
    let release!: () => void;
    this.codecTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await operation();
    } finally {
      release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.boss) await this.boss.stop({ graceful: true, timeout: 30_000 });
  }
}
