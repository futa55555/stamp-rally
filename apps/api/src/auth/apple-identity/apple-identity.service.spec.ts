import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  APPLE_ID_TOKEN_VERIFIER,
  AppleIdentityService,
} from './apple-identity.service.js';

const configServiceMock = {
  getOrThrow: vi.fn(),
};

const verifyAppleIdTokenMock = vi.fn();

describe('AppleIdentityService', () => {
  let service: AppleIdentityService;

  beforeEach(async () => {
    vi.resetAllMocks();

    configServiceMock.getOrThrow.mockReturnValue('com.example.stamp-rally');

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AppleIdentityService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: APPLE_ID_TOKEN_VERIFIER,
          useValue: verifyAppleIdTokenMock,
        },
      ],
    }).compile();

    service = moduleRef.get(AppleIdentityService);
  });

  it('verifies an identity token and returns the provider account ID', async () => {
    verifyAppleIdTokenMock.mockResolvedValue({
      payload: {
        sub: 'apple-user-123',
        nonce: 'nonce-123',
      },
      protectedHeader: {
        alg: 'RS256',
      },
    });

    const identity = await service.verifyIdentityToken(
      'apple-identity-token',
      'nonce-123',
    );

    expect(verifyAppleIdTokenMock).toHaveBeenCalledWith(
      'apple-identity-token',
      {
        algorithms: ['RS256'],
        issuer: 'https://appleid.apple.com',
        audience: 'com.example.stamp-rally',
        requiredClaims: ['sub', 'exp', 'nonce'],
      },
    );

    expect(identity).toEqual({
      providerAccountId: 'apple-user-123',
    });
  });

  it('rejects an empty nonce before verifying the token', async () => {
    await expect(
      service.verifyIdentityToken('apple-identity-token', ''),
    ).rejects.toThrow('Apple nonce must not be empty');

    expect(verifyAppleIdTokenMock).not.toHaveBeenCalled();
  });

  it('rejects a token with a different nonce', async () => {
    verifyAppleIdTokenMock.mockResolvedValue({
      payload: {
        sub: 'apple-user-123',
        nonce: 'different-nonce',
      },
      protectedHeader: {
        alg: 'RS256',
      },
    });

    await expect(
      service.verifyIdentityToken('apple-identity-token', 'expected-nonce'),
    ).rejects.toThrow('Invalid Apple identity token nonce');
  });

  it('rejects a token payload without a subject', async () => {
    verifyAppleIdTokenMock.mockResolvedValue({
      payload: {
        nonce: 'nonce-123',
      },
      protectedHeader: {
        alg: 'RS256',
      },
    });

    await expect(
      service.verifyIdentityToken('apple-identity-token', 'nonce-123'),
    ).rejects.toThrow('Invalid Apple identity token payload');
  });

  it('propagates an identity token verification error', async () => {
    verifyAppleIdTokenMock.mockRejectedValue(
      new Error('Invalid token signature'),
    );

    await expect(
      service.verifyIdentityToken('invalid-apple-identity-token', 'nonce-123'),
    ).rejects.toThrow('Invalid token signature');
  });
});
