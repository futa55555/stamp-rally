import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { AuthProvider } from '../generated/prisma/enums.js';
import { AppleIdentityService } from './apple-identity/apple-identity.service.js';
import { AuthAccountRepository } from './auth-account.repository.js';
import { AuthService } from './auth.service.js';
import { GoogleIdentityService } from './google-identity/google-identity.service.js';
import { SessionService } from './session/session.service.js';

const authAccountRepositoryMock = {
  findUserByIdentity: vi.fn(),
  createUserWithIdentity: vi.fn(),
};

const sessionServiceMock = {
  createSession: vi.fn(),
  refreshSession: vi.fn(),
  revokeSession: vi.fn(),
};

const googleIdentityServiceMock = {
  verifyIdToken: vi.fn(),
};

const appleIdentityServiceMock = {
  verifyIdentityToken: vi.fn(),
};

const sessionTokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  refreshTokenExpiresAt: new Date('2026-10-03T00:00:00.000Z'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthAccountRepository,
          useValue: authAccountRepositoryMock,
        },
        {
          provide: SessionService,
          useValue: sessionServiceMock,
        },
        {
          provide: GoogleIdentityService,
          useValue: googleIdentityServiceMock,
        },
        {
          provide: AppleIdentityService,
          useValue: appleIdentityServiceMock,
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  it('logs in an existing Google user', async () => {
    googleIdentityServiceMock.verifyIdToken.mockResolvedValue({
      providerAccountId: 'google-user-123',
    });
    authAccountRepositoryMock.findUserByIdentity.mockResolvedValue({
      id: 'user-123',
    });
    sessionServiceMock.createSession.mockResolvedValue(sessionTokens);

    const result = await service.loginWithGoogle('google-id-token');

    expect(googleIdentityServiceMock.verifyIdToken).toHaveBeenCalledWith(
      'google-id-token',
    );

    expect(authAccountRepositoryMock.findUserByIdentity).toHaveBeenCalledWith(
      AuthProvider.GOOGLE,
      'google-user-123',
    );

    expect(
      authAccountRepositoryMock.createUserWithIdentity,
    ).not.toHaveBeenCalled();

    expect(sessionServiceMock.createSession).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(sessionTokens);
  });

  it('creates and logs in a new Google user', async () => {
    googleIdentityServiceMock.verifyIdToken.mockResolvedValue({
      providerAccountId: 'google-user-123',
    });
    authAccountRepositoryMock.findUserByIdentity.mockResolvedValue(null);
    authAccountRepositoryMock.createUserWithIdentity.mockResolvedValue({
      id: 'new-user-123',
    });
    sessionServiceMock.createSession.mockResolvedValue(sessionTokens);

    const result = await service.loginWithGoogle('google-id-token');

    expect(
      authAccountRepositoryMock.createUserWithIdentity,
    ).toHaveBeenCalledWith(AuthProvider.GOOGLE, 'google-user-123');

    expect(sessionServiceMock.createSession).toHaveBeenCalledWith(
      'new-user-123',
    );
    expect(result).toEqual(sessionTokens);
  });

  it('logs in an existing Apple user', async () => {
    appleIdentityServiceMock.verifyIdentityToken.mockResolvedValue({
      providerAccountId: 'apple-user-123',
    });
    authAccountRepositoryMock.findUserByIdentity.mockResolvedValue({
      id: 'user-123',
    });
    sessionServiceMock.createSession.mockResolvedValue(sessionTokens);

    const result = await service.loginWithApple(
      'apple-identity-token',
      'nonce-123',
    );

    expect(appleIdentityServiceMock.verifyIdentityToken).toHaveBeenCalledWith(
      'apple-identity-token',
      'nonce-123',
    );

    expect(authAccountRepositoryMock.findUserByIdentity).toHaveBeenCalledWith(
      AuthProvider.APPLE,
      'apple-user-123',
    );

    expect(sessionServiceMock.createSession).toHaveBeenCalledWith('user-123');
    expect(result).toEqual(sessionTokens);
  });

  it('rejects an invalid Google identity token', async () => {
    googleIdentityServiceMock.verifyIdToken.mockRejectedValue(
      new Error('Invalid signature'),
    );

    await expect(
      service.loginWithGoogle('invalid-google-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authAccountRepositoryMock.findUserByIdentity).not.toHaveBeenCalled();
  });

  it('rejects an invalid Apple identity token', async () => {
    appleIdentityServiceMock.verifyIdentityToken.mockRejectedValue(
      new Error('Invalid signature'),
    );

    await expect(
      service.loginWithApple('invalid-apple-token', 'nonce-123'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(authAccountRepositoryMock.findUserByIdentity).not.toHaveBeenCalled();
  });

  it('recovers when another request creates the same user first', async () => {
    const uniqueConstraintError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: 'test',
      },
    );

    googleIdentityServiceMock.verifyIdToken.mockResolvedValue({
      providerAccountId: 'google-user-123',
    });

    authAccountRepositoryMock.findUserByIdentity
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'concurrently-created-user',
      });

    authAccountRepositoryMock.createUserWithIdentity.mockRejectedValue(
      uniqueConstraintError,
    );
    sessionServiceMock.createSession.mockResolvedValue(sessionTokens);

    const result = await service.loginWithGoogle('google-id-token');

    expect(authAccountRepositoryMock.findUserByIdentity).toHaveBeenCalledTimes(
      2,
    );

    expect(sessionServiceMock.createSession).toHaveBeenCalledWith(
      'concurrently-created-user',
    );
    expect(result).toEqual(sessionTokens);
  });

  it('does not hide a non-unique database error', async () => {
    const databaseError = new Error('Database unavailable');

    googleIdentityServiceMock.verifyIdToken.mockResolvedValue({
      providerAccountId: 'google-user-123',
    });
    authAccountRepositoryMock.findUserByIdentity.mockResolvedValue(null);
    authAccountRepositoryMock.createUserWithIdentity.mockRejectedValue(
      databaseError,
    );

    await expect(service.loginWithGoogle('google-id-token')).rejects.toBe(
      databaseError,
    );

    expect(sessionServiceMock.createSession).not.toHaveBeenCalled();
  });

  it('refreshes a session', async () => {
    sessionServiceMock.refreshSession.mockResolvedValue(sessionTokens);

    const result = await service.refresh('current-refresh-token');

    expect(sessionServiceMock.refreshSession).toHaveBeenCalledWith(
      'current-refresh-token',
    );
    expect(result).toEqual(sessionTokens);
  });

  it('logs out a session', async () => {
    sessionServiceMock.revokeSession.mockResolvedValue(undefined);

    await service.logout('session-123');

    expect(sessionServiceMock.revokeSession).toHaveBeenCalledWith(
      'session-123',
    );
  });
});
