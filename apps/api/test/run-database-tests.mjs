import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { config } from 'dotenv';
import pg from 'pg';

// Every run gets its own database: existing test suites delete their fixtures.
config({ path: '.env.test', quiet: true });
const configuration = process.argv[2];
if (!['integration', 'e2e', 'all'].includes(configuration)) {
  throw new Error('Expected integration, e2e, or all');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const databaseName = `stamp_rally_test_${randomUUID().replaceAll('-', '')}`;
const testUrl = new URL(process.env.DATABASE_URL);
const adminUrl = new URL(testUrl);
adminUrl.pathname = '/postgres';
testUrl.pathname = `/${databaseName}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const environment = {
  ...process.env,
  DATABASE_URL: testUrl.toString(),
  JWT_ACCESS_SECRET: 'isolated-test-access-secret',
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
  GOOGLE_OAUTH_CLIENT_ID: 'isolated-test-client',
  APPLE_OAUTH_CLIENT_ID: 'isolated-test-client',
};

function run(arguments_) {
  return new Promise((resolve, reject) => {
    const child = spawn('pnpm', ['exec', ...arguments_], {
      env: environment,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code, signal) =>
      code === 0
        ? resolve()
        : reject(new Error(`Test command failed (${signal ?? code})`)),
    );
  });
}

let created = false;
try {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  await run(['prisma', 'migrate', 'deploy', '--config', './prisma7.config.ts']);
  if (configuration !== 'e2e') {
    await run(['tsc', '--project', './tsconfig.scripts.json']);
    await run(['vitest', 'run', '--config', './vitest.config.integration.ts']);
  }
  if (configuration !== 'integration')
    await run(['vitest', 'run', '--config', './vitest.config.e2e.ts']);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) {
    // This name is generated above and can only refer to this run's test database.
    await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    console.log('Removed the disposable test database.');
  }
  await admin.end();
}
