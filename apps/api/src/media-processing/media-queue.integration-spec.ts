import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ObjectStorageService } from '../storage/object-storage.service.js';
import { MediaQueue, MEDIA_PROCESS_QUEUE } from './media-queue.service.js';

describe('MediaQueue real PostgreSQL integration', () => {
  const queues: MediaQueue[] = [];
  let pool: Pool;
  let config: ConfigService;

  beforeAll(() => {
    // run-database-tests.mjs supplies a fresh, isolated database for this suite.
    config = new ConfigService({ DATABASE_URL: process.env.DATABASE_URL });
    pool = new Pool({
      connectionString: config.getOrThrow<string>('DATABASE_URL'),
    });
  });

  afterAll(async () => {
    for (const queue of queues) await queue.onModuleDestroy();
    await pool.end();
  });

  it('persists an enqueue across producer shutdown, retries the handler, and serializes both codec queues', async () => {
    const storage = {
      delete: vi.fn(),
      abortMultipart: vi.fn(),
    } as unknown as ObjectStorageService;
    const postId = randomUUID();
    const legacyId = randomUUID();
    const producer = new MediaQueue(config, storage);
    queues.push(producer);
    await producer.enqueueProcess(postId, 7);
    await producer.enqueueProcess(postId, 7);
    await producer.enqueueLegacy(legacyId);
    const before = await pool.query<{
      data: { postId: string; version: number };
    }>("SELECT data FROM pgboss.job WHERE name = $1 AND data->>'postId' = $2", [
      MEDIA_PROCESS_QUEUE,
      postId,
    ]);
    expect(before.rows).toEqual([{ data: { postId, version: 7 } }]);
    await producer.onModuleDestroy();

    // Keep this real retry test short without changing production retry settings.
    await pool.query(
      "UPDATE pgboss.job SET retry_delay = 0, retry_backoff = false WHERE name = $1 AND data->>'postId' = $2",
      [MEDIA_PROCESS_QUEUE, postId],
    );
    const worker = new MediaQueue(config, storage);
    queues.push(worker);
    let active = 0;
    let maximumActive = 0;
    let attempts = 0;
    const process = vi.fn(async (receivedId: string, version: number) => {
      expect(receivedId).toBe(postId);
      expect(version).toBe(7);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        attempts += 1;
        if (attempts === 1)
          throw new Error('simulated transient worker failure');
      } finally {
        active -= 1;
      }
    });
    const migrateLegacy = vi.fn(async (receivedId: string) => {
      expect(receivedId).toBe(legacyId);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 50));
      active -= 1;
    });
    await worker.startWorkers({
      process,
      migrateLegacy,
      cleanup: vi.fn(async () => undefined),
    });
    await vi.waitFor(
      async () => {
        const result = await pool.query<{ state: string; retry_count: number }>(
          "SELECT state, retry_count FROM pgboss.job WHERE name = $1 AND data->>'postId' = $2",
          [MEDIA_PROCESS_QUEUE, postId],
        );
        expect(result.rows).toEqual([{ state: 'completed', retry_count: 1 }]);
        expect(migrateLegacy).toHaveBeenCalledOnce();
      },
      { timeout: 10_000, interval: 100 },
    );
    expect(process).toHaveBeenCalledTimes(2);
    expect(maximumActive).toBe(1);
    await worker.onModuleDestroy();
  }, 15_000);
});
