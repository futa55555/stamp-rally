import {
  assertLocalDevelopmentDatabase,
  developmentTokenOptions,
  parseDevelopmentCommand,
} from './environment.js';

const environment = {
  DATABASE_URL:
    'postgresql://user:password@localhost:5432/stamp_rally?schema=public',
  JWT_ACCESS_SECRET: 'unit-test-secret',
  JWT_ACCESS_TTL_SECONDS: '900',
  REFRESH_TOKEN_TTL_DAYS: '30',
};

describe('Local development command safety', () => {
  it.each([undefined, 'development', 'test'])(
    'allows NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() =>
        assertLocalDevelopmentDatabase({ ...environment, NODE_ENV }),
      ).not.toThrow();
    },
  );

  it.each(['production', 'staging', 'preview', ''])(
    'rejects NODE_ENV=%s',
    (NODE_ENV) => {
      expect(() =>
        assertLocalDevelopmentDatabase({ ...environment, NODE_ENV }),
      ).toThrow('NODE_ENV');
    },
  );

  it.each(['localhost', '127.0.0.1', '[::1]'])(
    'allows loopback host %s',
    (host) => {
      expect(() =>
        assertLocalDevelopmentDatabase({
          DATABASE_URL: `postgres://user:password@${host}:5432/stamp_rally`,
        }),
      ).not.toThrow();
    },
  );

  it.each([
    'stamp_rally',
    'stamp_rally_test',
    `stamp_rally_test_${'a'.repeat(32)}`,
  ])('allows database %s', (database) => {
    expect(() =>
      assertLocalDevelopmentDatabase({
        DATABASE_URL: `postgresql://localhost/${database}`,
      }),
    ).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'not-a-url',
    'https://localhost/stamp_rally',
    'postgresql://remote.example/stamp_rally',
    'postgresql://localhost.example/stamp_rally',
    'postgresql://192.168.1.2/stamp_rally',
    'postgresql://0.0.0.0/stamp_rally',
    'postgresql:///stamp_rally',
    'postgresql://localhost/production',
    'postgresql://localhost/postgres',
    'postgresql://localhost/stamp_rally_test_other',
    'postgresql://localhost/stamp_rally_test_123',
    'postgresql://localhost/stamp_rally/extra',
    'postgresql://localhost/%73tamp_rally',
    'postgresql://localhost/stamp_rally#fragment',
    'postgresql://localhost/stamp_rally?host=remote.example',
    'postgresql://localhost/stamp_rally?schema=public&host=remote.example',
    'postgresql://localhost/stamp_rally?%68ost=remote.example',
    'postgresql://localhost/stamp_rally?hostaddr=192.168.1.1',
    'postgresql://localhost/stamp_rally?port=6543',
    'postgresql://localhost/stamp_rally?database=production',
    'postgresql://localhost/stamp_rally?dbname=production',
    'postgresql://localhost/stamp_rally?service=production',
    'postgresql://localhost/stamp_rally?sslmode=require',
  ])('rejects unsafe or unsupported DATABASE_URL=%s', (DATABASE_URL) => {
    expect(() => assertLocalDevelopmentDatabase({ DATABASE_URL })).toThrow();
  });

  it('does not leak credentials in errors', () => {
    try {
      assertLocalDevelopmentDatabase({
        DATABASE_URL:
          'postgresql://private-user:private-password@remote.example/production',
      });
      expect.unreachable('Expected a connection guard error');
    } catch (error) {
      expect(String(error)).not.toContain('private-user');
      expect(String(error)).not.toContain('private-password');
    }
  });
});

describe('Development command arguments', () => {
  it('accepts seed without arguments', () => {
    expect(parseDevelopmentCommand(['seed'])).toEqual({ action: 'seed' });
  });

  it.each(['dev-user-1', 'dev-user-2', 'dev-user-3'])(
    'accepts token --user %s',
    (userKey) => {
      expect(parseDevelopmentCommand(['token', '--user', userKey])).toEqual({
        action: 'token',
        userKey,
      });
    },
  );

  it.each(
    [
      [],
      ['reset'],
      ['seed', '--force'],
      ['token'],
      ['token', '--user'],
      ['token', '--user', 'dev-user-4'],
      ['token', '--user', 'somebody-else'],
      ['token', '--user', 'dev-user-1', '--force'],
      ['token', '--user=dev-user-1'],
    ].map((args) => ({ args })),
  )('rejects unsupported arguments $args', ({ args }) => {
    expect(() => parseDevelopmentCommand(args)).toThrow('Usage:');
  });
});

describe('Development token configuration', () => {
  it('uses exactly the configured signing secret and access TTL', () => {
    expect(developmentTokenOptions(environment)).toEqual({
      secret: environment.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: 900 },
    });
  });

  it.each([undefined, '', ' '])('rejects empty signing secret %s', (secret) => {
    expect(() =>
      developmentTokenOptions({ ...environment, JWT_ACCESS_SECRET: secret }),
    ).toThrow('JWT_ACCESS_SECRET');
  });

  it.each(['JWT_ACCESS_TTL_SECONDS', 'REFRESH_TOKEN_TTL_DAYS'])(
    'rejects missing or invalid %s',
    (key) => {
      for (const value of [
        undefined,
        '',
        '0',
        '-1',
        '1.5',
        'NaN',
        'Infinity',
        '9007199254740992',
      ]) {
        expect(() =>
          developmentTokenOptions({ ...environment, [key]: value }),
        ).toThrow(key);
      }
    },
  );
});
