import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthTokenService } from '../auth-token/auth-token.service.js';
import { SessionRepository } from './session.repository.js';
import { SessionService } from './session.service.js';

const authTokenServiceMock = {
  generateRefreshToken: vi.fn(),
  hashRefreshToken: vi.fn(),
  getRefreshTokenExpiresAt: vi.fn(),
  signAccessToken: vi.fn(),
};

const sessionRepositoryMock = {
  create: vi.fn(),
  findActiveByRefreshTokenHash: vi.fn(),
  rotateRefreshToken: vi.fn(),
  revoke: vi.fn(),
};

describe('SessionService', () => {
  let service: SessionService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: AuthTokenService,
          useValue: authTokenServiceMock,
        },
        {
          provide: SessionRepository,
          useValue: sessionRepositoryMock,
        },
      ],
    }).compile();

    service = moduleRef.get(SessionService);
  });

  it('creates a session and returns tokens', async () => {
    const expiresAt = new Date('2026-10-03T00:00:00.000Z');

    authTokenServiceMock.generateRefreshToken.mockReturnValue('refresh-token');
    authTokenServiceMock.hashRefreshToken.mockReturnValue('refresh-token-hash');

    authTokenServiceMock.getRefreshTokenExpiresAt.mockReturnValue(expiresAt);

    sessionRepositoryMock.create.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
    });

    authTokenServiceMock.signAccessToken.mockResolvedValue('access-token');

    const result = await service.createSession('user-123');

    expect(authTokenServiceMock.hashRefreshToken).toHaveBeenCalledWith(
      'refresh-token',
    );

    expect(sessionRepositoryMock.create).toHaveBeenCalledWith(
      'user-123',
      'refresh-token-hash',
      expiresAt,
    );

    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith(
      'user-123',
      'session-123',
    );

    expect(result).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      refreshTokenExpiresAt: expiresAt,
    });
  });

  it('rotates a refresh token', async () => {
    const expiresAt = new Date('2026-10-03T00:00:00.000Z');

    authTokenServiceMock.hashRefreshToken
      .mockReturnValueOnce('current-refresh-token-hash')
      .mockReturnValueOnce('next-refresh-token-hash');

    sessionRepositoryMock.findActiveByRefreshTokenHash.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
    });

    authTokenServiceMock.generateRefreshToken.mockReturnValue(
      'next-refresh-token',
    );

    authTokenServiceMock.getRefreshTokenExpiresAt.mockReturnValue(expiresAt);
    authTokenServiceMock.signAccessToken.mockResolvedValue('next-access-token');
    sessionRepositoryMock.rotateRefreshToken.mockResolvedValue(true);

    const result = await service.refreshSession('current-refresh-token');

    const now =
      sessionRepositoryMock.findActiveByRefreshTokenHash.mock.calls[0][1];

    expect(
      sessionRepositoryMock.findActiveByRefreshTokenHash,
    ).toHaveBeenCalledWith('current-refresh-token-hash', now);

    expect(sessionRepositoryMock.rotateRefreshToken).toHaveBeenCalledWith(
      'session-123',
      'current-refresh-token-hash',
      'next-refresh-token-hash',
      expiresAt,
      now,
    );

    expect(authTokenServiceMock.signAccessToken).toHaveBeenCalledWith(
      'user-123',
      'session-123',
    );

    expect(result).toEqual({
      accessToken: 'next-access-token',
      refreshToken: 'next-refresh-token',
      refreshTokenExpiresAt: expiresAt,
    });
  });

  it('rejects an unknown or expired refresh token', async () => {
    authTokenServiceMock.hashRefreshToken.mockReturnValue('refresh-token-hash');

    sessionRepositoryMock.findActiveByRefreshTokenHash.mockResolvedValue(null);

    await expect(
      service.refreshSession('invalid-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(sessionRepositoryMock.rotateRefreshToken).not.toHaveBeenCalled();

    expect(authTokenServiceMock.generateRefreshToken).not.toHaveBeenCalled();
  });

  it('rejects a refresh token when rotation loses a race', async () => {
    const expiresAt = new Date('2026-10-03T00:00:00.000Z');

    authTokenServiceMock.hashRefreshToken
      .mockReturnValueOnce('current-refresh-token-hash')
      .mockReturnValueOnce('next-refresh-token-hash');

    sessionRepositoryMock.findActiveByRefreshTokenHash.mockResolvedValue({
      id: 'session-123',
      userId: 'user-123',
    });

    authTokenServiceMock.generateRefreshToken.mockReturnValue(
      'next-refresh-token',
    );

    authTokenServiceMock.getRefreshTokenExpiresAt.mockReturnValue(expiresAt);
    authTokenServiceMock.signAccessToken.mockResolvedValue('next-access-token');

    sessionRepositoryMock.rotateRefreshToken.mockResolvedValue(false);

    await expect(
      service.refreshSession('current-refresh-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('revokes a session', async () => {
    sessionRepositoryMock.revoke.mockResolvedValue(true);

    await expect(service.revokeSession('session-123')).resolves.toBeUndefined();

    expect(sessionRepositoryMock.revoke).toHaveBeenCalledWith('session-123');
  });
});
