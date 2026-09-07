import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthTokenService } from '../src/auth/auth-token/auth-token.service.js';
import { SessionRepository } from '../src/auth/session/session.repository.js';
import { SessionService } from '../src/auth/session/session.service.js';
import type { PrismaService } from '../src/database/prisma.service.js';
import { Prisma } from '../src/generated/prisma/client.js';
import {
  DevelopmentCommandError,
  developmentTokenOptions,
  type DevelopmentEnvironment,
} from './environment.js';

// These are selectors, not the current names: users may rename themselves via API.
export const DEVELOPMENT_USERS = [
  { key: 'dev-user-1', id: '00000000-0000-4000-8000-000000000001' },
  { key: 'dev-user-2', id: '00000000-0000-4000-8000-000000000002' },
  { key: 'dev-user-3', id: '00000000-0000-4000-8000-000000000003' },
] as const;

const userSelection = { id: true, name: true, status: true } as const;

export async function seedDevelopmentUsers(prisma: PrismaService) {
  try {
    return await prisma.$transaction(async (transaction) => {
      const users = [];
      let createdCount = 0;
      for (const fixture of DEVELOPMENT_USERS) {
        const existing = await transaction.user.findUnique({
          where: { id: fixture.id },
          select: userSelection,
        });
        const user =
          existing ??
          (await transaction.user.create({
            data: { id: fixture.id, name: fixture.key, status: 'ACTIVE' },
            select: userSelection,
          }));
        if (!existing) createdCount++;
        users.push({ key: fixture.key, ...user });
      }
      return {
        users,
        createdCount,
        existingCount: users.length - createdCount,
      };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new DevelopmentCommandError(
        'A development user name or ID is already in use. No seed changes were saved; existing users were not modified.',
      );
    }
    throw error;
  }
}

export async function issueDevelopmentTokens(
  prisma: PrismaService,
  environment: DevelopmentEnvironment,
  userKey: string,
) {
  const fixture = DEVELOPMENT_USERS.find((user) => user.key === userKey);
  if (!fixture) {
    throw new DevelopmentCommandError(
      'Select dev-user-1, dev-user-2, or dev-user-3.',
    );
  }

  const jwt = new JwtService(developmentTokenOptions(environment));
  const authTokens = new AuthTokenService(jwt, new ConfigService(environment));
  const sessions = new SessionService(
    authTokens,
    new SessionRepository(prisma),
  );
  const user = await prisma.user.findUnique({
    where: { id: fixture.id },
    select: { ...userSelection, _count: { select: { accounts: true } } },
  });

  if (!user) {
    throw new DevelopmentCommandError(
      'Development user not found. Run pnpm --filter api db:seed first.',
    );
  }
  if (user.status !== 'ACTIVE') {
    throw new DevelopmentCommandError('The development user must be ACTIVE.');
  }
  if (user._count.accounts !== 0) {
    throw new DevelopmentCommandError(
      'Cannot issue development tokens for a user linked to Google or Apple.',
    );
  }

  const tokens = await sessions.createSession(user.id);
  const { exp } = jwt.decode<{ exp: number }>(tokens.accessToken);
  return {
    user: {
      key: fixture.key,
      id: user.id,
      name: user.name,
      status: user.status,
    },
    ...tokens,
    accessTokenExpiresAt: new Date(exp * 1000).toISOString(),
  };
}
