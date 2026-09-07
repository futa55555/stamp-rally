import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { PrismaService } from '../src/database/prisma.service.js';
import {
  assertLocalDevelopmentDatabase,
  DevelopmentCommandError,
  developmentTokenOptions,
  parseDevelopmentCommand,
} from './environment.js';
import { issueDevelopmentTokens, seedDevelopmentUsers } from './users.js';

// Compiled entrypoint: apps/api/.dev-dist/scripts/cli.js. Existing shell variables win,
// matching ConfigModule's behavior, regardless of the caller's working directory.
config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  quiet: true,
});

async function main() {
  const command = parseDevelopmentCommand(process.argv.slice(2));
  assertLocalDevelopmentDatabase(process.env);
  if (command.action === 'token') developmentTokenOptions(process.env);

  const prisma = new PrismaService(new ConfigService(process.env));
  try {
    await prisma.$connect();
    const result =
      command.action === 'seed'
        ? await seedDevelopmentUsers(prisma)
        : await issueDevelopmentTokens(prisma, process.env, command.userKey);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await main();
} catch (error) {
  // Driver errors can include credentials/connection strings. Only our own errors
  // are safe to print. Tokens are intentionally emitted only on successful login.
  console.error(
    error instanceof DevelopmentCommandError
      ? error.message
      : 'Development command failed. Check the local database, migrations, and configuration.',
  );
  process.exitCode = 1;
}
