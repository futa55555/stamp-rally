import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const migration = readFileSync(
  new URL(
    '../../prisma/migrations/20260907133000_add_trip_domain/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

const removeCommentsMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260908000000_remove_comments/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

const mobileMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260909000000_mobile_api/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const mediaMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260910000000_media_uploads/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

const invitationStatesMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260910020000_invitation_states/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const invitationLinksMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260910020100_invitation_links/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const tripTemplatesMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260912000000_trip_templates/migration.sql',
    import.meta.url,
  ),
  'utf8',
);
const stampGenresMigration = readFileSync(
  new URL(
    '../../prisma/migrations/20260912010000_stamp_genres/migration.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('Trip domain migration integration', () => {
  let client: Client;
  let schema: string;
  let schemaCreated = false;

  beforeEach(async () => {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
    client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    schema = `domain_migration_${randomUUID().replaceAll('-', '')}`;
    // Only this test-created schema is ever dropped; public data is not in the search path.
    if (!/^domain_migration_[a-f0-9]{32}$/.test(schema))
      throw new Error('Invalid test schema');
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await client.query("SELECT set_config('search_path', $1, false)", [schema]);
    await client.query(
      'CREATE TABLE users (id UUID PRIMARY KEY, name VARCHAR(20))',
    );
  });

  afterEach(async () => {
    if (!client) return;
    try {
      await client.query('ROLLBACK');
      if (schemaCreated) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    } finally {
      schemaCreated = false;
      await client.end();
    }
  });

  it('backfills memberships without merging names or modifying posts, reads and timestamps', async () => {
    const owner = randomUUID(),
      trip = randomUUID(),
      genre = randomUUID(),
      secondGenre = randomUUID(),
      stamp = randomUUID(),
      secondStamp = randomUUID(),
      post = randomUUID();
    const timestamp = new Date('2026-09-09T03:00:00Z');
    await client.query('INSERT INTO users (id,name) VALUES ($1,$2)', [
      owner,
      'Owner',
    ]);
    await client.query(migration);
    await client.query(removeCommentsMigration);
    await client.query(mobileMigration);
    await client.query(
      "INSERT INTO trips (id,name,start_date,end_date,created_by_id,updated_at) VALUES ($1,'Trip','2026-09-09','2026-09-09',$2,$3)",
      [trip, owner, timestamp],
    );
    for (const id of [genre, secondGenre])
      await client.query(
        "INSERT INTO genres (id,trip_id,name,updated_at) VALUES ($1,$2,'Genre',$3)",
        [id, trip, timestamp],
      );
    for (const [id, parent] of [
      [stamp, genre],
      [secondStamp, secondGenre],
    ])
      await client.query(
        "INSERT INTO stamps (id,genre_id,name,description,created_at,updated_at) VALUES ($1,$2,'同名スタンプ','説明',$3,$3)",
        [id, parent, timestamp],
      );
    await client.query(
      "INSERT INTO posts (id,stamp_id,author_id,media_type,media_url,is_favorite,created_at,updated_at) VALUES ($1,$2,$3,'IMAGE','https://legacy.test/photo.jpg',true,$4,$4)",
      [post, stamp, owner, timestamp],
    );
    await client.query(
      'INSERT INTO photo_reads (user_id,post_id,read_at) VALUES ($1,$2,$3)',
      [owner, post, timestamp],
    );
    await client.query(mediaMigration);
    const originalPosts = (
      await client.query('SELECT * FROM posts ORDER BY id')
    ).rows;
    const originalStamps = (
      await client.query('SELECT * FROM stamps ORDER BY id')
    ).rows;
    const originalReads = (await client.query('SELECT * FROM photo_reads'))
      .rows;
    await client.query(stampGenresMigration);
    expect(
      (await client.query('SELECT * FROM stamps ORDER BY id')).rows,
    ).toEqual(
      originalStamps.map(({ genre_id: _genre, ...row }) => ({
        ...row,
        trip_id: trip,
      })),
    );
    expect(
      (await client.query('SELECT * FROM stamp_genres ORDER BY stamp_id')).rows,
    ).toEqual(
      originalStamps.map((row) => ({
        stamp_id: row.id,
        genre_id: row.genre_id,
      })),
    );
    expect(
      (await client.query('SELECT * FROM posts ORDER BY id')).rows,
    ).toEqual(originalPosts);
    expect((await client.query('SELECT * FROM photo_reads')).rows).toEqual(
      originalReads,
    );
    await client.query(
      'INSERT INTO stamp_genres (stamp_id,genre_id) VALUES ($1,$2)',
      [stamp, secondGenre],
    );
    await expect(
      client.query(
        'INSERT INTO stamp_genres (stamp_id,genre_id) VALUES ($1,$2)',
        [stamp, secondGenre],
      ),
    ).rejects.toMatchObject({ code: '23505' });
    await client.query(
      'DELETE FROM stamp_genres WHERE stamp_id=$1 AND genre_id=$2',
      [stamp, genre],
    );
    expect((await client.query('SELECT * FROM posts')).rows).toEqual(
      originalPosts,
    );
    await client.query('DELETE FROM trips WHERE id=$1', [trip]);
    expect((await client.query('SELECT * FROM stamps')).rows).toEqual([]);
    expect((await client.query('SELECT * FROM stamp_genres')).rows).toEqual([]);
    expect((await client.query('SELECT * FROM posts')).rows).toEqual([]);
  });

  it('reports duplicate names, aborts before domain DDL, and preserves existing users', async () => {
    const first = randomUUID();
    const second = randomUUID();
    const onboarding = randomUUID();
    await client.query(
      'INSERT INTO users (id, name) VALUES ($1, $4), ($2, $4), ($3, NULL)',
      [first, second, onboarding, '重複名'],
    );
    const before = (
      await client.query('SELECT id, name FROM users ORDER BY id')
    ).rows;

    await expect(client.query(migration)).rejects.toMatchObject({
      code: 'P0001',
      message:
        "Cannot make users.name unique; resolve duplicate names first: '重複名'",
    });
    // The migration's BEGIN remains aborted until rolled back by the migration runner.
    await expect(client.query('SELECT 1')).rejects.toMatchObject({
      code: '25P02',
    });
    await client.query('ROLLBACK');

    expect(
      (await client.query('SELECT id, name FROM users ORDER BY id')).rows,
    ).toEqual(before);
    const tables = await client.query(
      'SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = $1 ORDER BY tablename',
      [schema],
    );
    expect(tables.rows).toEqual([{ tablename: 'users' }]);
    const enums = await client.query(
      "SELECT t.typname FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = $1 AND t.typtype = 'e'",
      [schema],
    );
    expect(enums.rows).toEqual([]);
    const indexes = await client.query(
      'SELECT indexname FROM pg_catalog.pg_indexes WHERE schemaname = $1 ORDER BY indexname',
      [schema],
    );
    expect(indexes.rows).toEqual([{ indexname: 'users_pkey' }]);
  });

  it('removes populated comments while preserving the hierarchy and posts', async () => {
    const owner = randomUUID();
    const trip = randomUUID();
    const genre = randomUUID();
    const stamp = randomUUID();
    await client.query('INSERT INTO users (id, name) VALUES ($1, $2)', [
      owner,
      'Owner',
    ]);
    await client.query(migration);
    await client.query(
      "INSERT INTO trips (id, name, start_date, end_date, created_by_id, updated_at) VALUES ($1, 'Trip', '2026-09-08', '2026-09-08', $2, CURRENT_TIMESTAMP)",
      [trip, owner],
    );
    await client.query(
      "INSERT INTO genres (id, trip_id, name, updated_at) VALUES ($1, $2, 'Genre', CURRENT_TIMESTAMP)",
      [genre, trip],
    );
    await client.query(
      "INSERT INTO stamps (id, genre_id, name, updated_at) VALUES ($1, $2, 'Stamp', CURRENT_TIMESTAMP)",
      [stamp, genre],
    );
    await client.query(
      "INSERT INTO posts (id, stamp_id, author_id, media_type, media_url, updated_at) VALUES ($1, $2, $3, 'IMAGE', 'https://example.com/photo.jpg', CURRENT_TIMESTAMP)",
      [randomUUID(), stamp, owner],
    );
    await client.query(
      "INSERT INTO comments (id, stamp_id, author_id, text, updated_at) VALUES ($1, $2, $3, 'Existing comment', CURRENT_TIMESTAMP)",
      [randomUUID(), stamp, owner],
    );
    const tables = ['users', 'trips', 'genres', 'stamps', 'posts'];
    const before = [];
    for (const table of tables) {
      before.push(
        (await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
      );
    }

    await client.query(removeCommentsMigration);

    expect(
      (await client.query("SELECT to_regclass('comments') AS table_name")).rows,
    ).toEqual([{ table_name: null }]);
    for (const [index, table] of tables.entries()) {
      expect(
        (await client.query(`SELECT * FROM ${table} ORDER BY id`)).rows,
      ).toEqual(before[index]);
    }
  });

  it('accepts multiple unnamed users and enforces the trip date range after migration', async () => {
    const owner = randomUUID();
    await client.query(
      'INSERT INTO users (id, name) VALUES ($1, NULL), ($2, NULL)',
      [owner, randomUUID()],
    );
    await client.query(migration);
    expect(
      (
        await client.query(
          'SELECT COUNT(*)::int AS count FROM users WHERE name IS NULL',
        )
      ).rows,
    ).toEqual([{ count: 2 }]);

    const insertTrip =
      'INSERT INTO trips (id, name, start_date, end_date, created_by_id, updated_at) VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)';
    await expect(
      client.query(insertTrip, [
        randomUUID(),
        '旅行',
        '2026-09-08',
        '2026-09-07',
        owner,
      ]),
    ).rejects.toMatchObject({
      code: '23514',
      constraint: 'trips_date_range_check',
    });
    await client.query(insertTrip, [
      randomUUID(),
      '日帰り',
      '2026-09-07',
      '2026-09-07',
      owner,
    ]);
    expect((await client.query('SELECT name FROM trips')).rows).toEqual([
      { name: '日帰り' },
    ]);
  });
  it('adds empty activity metadata without changing existing trips or their children', async () => {
    const owner = randomUUID();
    const trip = randomUUID();
    const genre = randomUUID();
    const stamp = randomUUID();
    await client.query('INSERT INTO users (id, name) VALUES ($1, $2)', [
      owner,
      'Owner',
    ]);
    await client.query(migration);
    await client.query(mobileMigration);
    await client.query(
      "INSERT INTO trips (id, name, locations, start_date, end_date, created_by_id, updated_at) VALUES ($1, '既存旅行', ARRAY['沖縄'], '2026-09-12', '2026-09-13', $2, CURRENT_TIMESTAMP)",
      [trip, owner],
    );
    await client.query(
      "INSERT INTO genres (id, trip_id, name, updated_at) VALUES ($1, $2, '手動ジャンル', CURRENT_TIMESTAMP)",
      [genre, trip],
    );
    await client.query(
      "INSERT INTO stamps (id, genre_id, name, updated_at) VALUES ($1, $2, '手動スタンプ', CURRENT_TIMESTAMP)",
      [stamp, genre],
    );
    const originalTrip = (await client.query('SELECT * FROM trips')).rows[0];
    const originalGenres = (await client.query('SELECT * FROM genres')).rows;
    const originalStamps = (await client.query('SELECT * FROM stamps')).rows;
    await client.query(tripTemplatesMigration);
    expect((await client.query('SELECT * FROM trips')).rows).toEqual([
      { ...originalTrip, activity_presets: [], custom_activities: [] },
    ]);
    expect((await client.query('SELECT * FROM genres')).rows).toEqual(
      originalGenres,
    );
    expect((await client.query('SELECT * FROM stamps')).rows).toEqual(
      originalStamps,
    );
    await expect(
      client.query('UPDATE trips SET custom_activities = NULL'),
    ).rejects.toMatchObject({ code: '23502' });
  });
  it('quarantines legacy originals, preserves favorites/reads/timestamps, and queues cascade cleanup', async () => {
    const owner = randomUUID();
    const trip = randomUUID();
    const genre = randomUUID();
    const stamp = randomUUID();
    const post = randomUUID();
    const timestamp = new Date('2026-09-09T03:00:00Z');
    await client.query('INSERT INTO users (id, name) VALUES ($1, $2)', [
      owner,
      'Owner',
    ]);
    await client.query(migration);
    await client.query(removeCommentsMigration);
    await client.query(mobileMigration);
    await client.query(
      "INSERT INTO trips (id,name,start_date,end_date,created_by_id,updated_at) VALUES ($1,'Trip','2026-09-09','2026-09-09',$2,$3)",
      [trip, owner, timestamp],
    );
    await client.query(
      "INSERT INTO genres (id,trip_id,name,updated_at) VALUES ($1,$2,'Genre',$3)",
      [genre, trip, timestamp],
    );
    await client.query(
      "INSERT INTO stamps (id,genre_id,name,updated_at) VALUES ($1,$2,'Stamp',$3)",
      [stamp, genre, timestamp],
    );
    await client.query(
      "INSERT INTO posts (id,stamp_id,author_id,media_type,media_url,is_favorite,created_at,updated_at) VALUES ($1,$2,$3,'IMAGE','https://legacy.test/camera.heic',true,$4,$4)",
      [post, stamp, owner, timestamp],
    );
    await client.query(
      'INSERT INTO photo_reads (user_id,post_id,read_at) VALUES ($1,$2,$3)',
      [owner, post, timestamp],
    );
    await client.query(mediaMigration);
    expect(
      (
        await client.query(
          'SELECT id, status, is_legacy, media_url, original_key, is_favorite, created_at, updated_at FROM posts',
        )
      ).rows,
    ).toEqual([
      {
        id: post,
        status: 'LEGACY',
        is_legacy: true,
        media_url: 'https://legacy.test/camera.heic',
        original_key: null,
        is_favorite: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ]);
    expect(
      (
        await client.query('SELECT read_at FROM photo_reads WHERE post_id=$1', [
          post,
        ])
      ).rows,
    ).toEqual([{ read_at: timestamp }]);
    await client.query(
      "UPDATE posts SET status='READY',original_key='media/original',large_key='media/large',small_key='media/small' WHERE id=$1",
      [post],
    );
    await client.query('DELETE FROM trips WHERE id=$1', [trip]);
    const cleanup = (
      await client.query('SELECT keys,created_at FROM media_cleanup')
    ).rows;
    expect(cleanup).toHaveLength(1);
    expect(cleanup[0].keys).toEqual([
      'media/original',
      'media/large',
      'media/small',
    ]);
    expect(cleanup[0].created_at.getTime()).toBeGreaterThan(Date.now());
    expect(
      (await client.query('SELECT COUNT(*)::int AS count FROM photo_reads'))
        .rows,
    ).toEqual([{ count: 0 }]);
  });
  it('retires unanswered name invitations without changing accepted members', async () => {
    const owner = randomUUID(),
      pending = randomUUID(),
      accepted = randomUUID(),
      trip = randomUUID();
    await client.query(
      'INSERT INTO users (id, name) VALUES ($1, $4), ($2, $5), ($3, $6)',
      [owner, pending, accepted, 'Owner', 'Pending', 'Accepted'],
    );
    await client.query(migration);
    await client.query(removeCommentsMigration);
    await client.query(mobileMigration);
    await client.query(
      "INSERT INTO trips (id,name,start_date,end_date,created_by_id,updated_at) VALUES ($1,'Trip','2026-09-10','2026-09-11',$2,CURRENT_TIMESTAMP)",
      [trip, owner],
    );
    await client.query(
      'INSERT INTO trip_members (id,trip_id,user_id) VALUES ($1,$3,$4),($2,$3,$5)',
      [randomUUID(), randomUUID(), trip, owner, accepted],
    );
    await client.query(
      "INSERT INTO trip_invitations (id,trip_id,invitee_id,invited_by_id,status,updated_at) VALUES ($1,$3,$4,$6,'PENDING',CURRENT_TIMESTAMP), ($2,$3,$5,$6,'ACCEPTED',CURRENT_TIMESTAMP)",
      [randomUUID(), randomUUID(), trip, pending, accepted, owner],
    );
    const before = (
      await client.query('SELECT * FROM trip_members ORDER BY id')
    ).rows;
    await client.query(invitationStatesMigration);
    await client.query(invitationLinksMigration);
    expect(
      (await client.query('SELECT * FROM trip_members ORDER BY id')).rows,
    ).toEqual(before);
    const states = (
      await client.query(
        'SELECT status, generation, link_id FROM trip_invitations ORDER BY status::text',
      )
    ).rows;
    expect(states).toEqual([
      { status: 'ACCEPTED', generation: 1, link_id: null },
      { status: 'CANCELLED', generation: 1, link_id: null },
    ]);
  });
});
