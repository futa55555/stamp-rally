export class DevelopmentCommandError extends Error {}

export type DevelopmentEnvironment = Record<string, string | undefined>;

export type DevelopmentCommand =
  { action: 'seed' } | { action: 'token'; userKey: string };

export function parseDevelopmentCommand(args: string[]): DevelopmentCommand {
  if (args.length === 1 && args[0] === 'seed') {
    return { action: 'seed' };
  }
  if (
    args.length === 3 &&
    args[0] === 'token' &&
    args[1] === '--user' &&
    /^dev-user-[123]$/.test(args[2])
  ) {
    return { action: 'token', userKey: args[2] };
  }
  throw new DevelopmentCommandError(
    'Usage: pnpm --filter api db:seed | pnpm --filter api dev:token --user dev-user-1 (or dev-user-2 / dev-user-3)',
  );
}

/** Validate before constructing any database client. Never print connection URLs. */
export function assertLocalDevelopmentDatabase(
  environment: DevelopmentEnvironment,
): void {
  if (
    environment.NODE_ENV !== undefined &&
    !['development', 'test'].includes(environment.NODE_ENV)
  ) {
    throw new DevelopmentCommandError(
      'Development commands require NODE_ENV to be unset, development, or test.',
    );
  }

  let url: URL;
  try {
    if (!environment.DATABASE_URL) throw new Error('Missing URL');
    url = new URL(environment.DATABASE_URL);
  } catch {
    throw new DevelopmentCommandError(
      'DATABASE_URL must be a local PostgreSQL URL.',
    );
  }

  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname.toLowerCase()) ||
    url.hash !== ''
  ) {
    throw new DevelopmentCommandError(
      'Development commands only support PostgreSQL on localhost, 127.0.0.1, or [::1].',
    );
  }

  if (
    !/^\/(stamp_rally|stamp_rally_test(?:_[a-f0-9]{32})?)$/.test(url.pathname)
  ) {
    throw new DevelopmentCommandError(
      'Development commands only support stamp_rally, stamp_rally_test, or a disposable stamp_rally_test_<32 hex characters> database.',
    );
  }

  // pg-connection-string merges query parameters into connection options.
  // Only Prisma's schema selector is allowed, so ?host=remote cannot bypass us.
  if ([...url.searchParams.keys()].some((key) => key !== 'schema')) {
    throw new DevelopmentCommandError(
      'DATABASE_URL query parameters may only contain schema; connection overrides are not allowed.',
    );
  }
}

export function developmentTokenOptions(environment: DevelopmentEnvironment) {
  const secret = environment.JWT_ACCESS_SECRET;
  if (!secret?.trim()) {
    throw new DevelopmentCommandError('JWT_ACCESS_SECRET must not be empty.');
  }

  const expiresIn = Number(environment.JWT_ACCESS_TTL_SECONDS);
  if (!Number.isSafeInteger(expiresIn) || expiresIn <= 0) {
    throw new DevelopmentCommandError(
      'JWT_ACCESS_TTL_SECONDS must be a positive integer.',
    );
  }

  const refreshTokenTtlDays = Number(environment.REFRESH_TOKEN_TTL_DAYS);
  if (!Number.isSafeInteger(refreshTokenTtlDays) || refreshTokenTtlDays <= 0) {
    throw new DevelopmentCommandError(
      'REFRESH_TOKEN_TTL_DAYS must be a positive integer.',
    );
  }

  return { secret, signOptions: { expiresIn } };
}
