import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { OAuth2Client } from 'google-auth-library';
import { GoogleIdentityService } from './google-identity.service.js';

const configServiceMock = {
  getOrThrow: vi.fn(),
};

const oauthClientMock = {
  verifyIdToken: vi.fn(),
};

describe('GoogleIdentityService', () => {
  let service: GoogleIdentityService;

  beforeEach(async () => {
    vi.resetAllMocks();

    configServiceMock.getOrThrow.mockReturnValue(
      'google-client-id.apps.googleusercontent.com',
    );

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleIdentityService,
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: OAuth2Client,
          useValue: oauthClientMock,
        },
      ],
    }).compile();

    service = moduleRef.get(GoogleIdentityService);
  });

  it('verifies an ID token and returns the provider account ID', async () => {
    oauthClientMock.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        sub: 'google-user-123',
      }),
    });

    const identity = await service.verifyIdToken('google-id-token');

    expect(oauthClientMock.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'google-id-token',
      audience: 'google-client-id.apps.googleusercontent.com',
    });

    expect(identity).toEqual({
      providerAccountId: 'google-user-123',
    });
  });

  it('rejects a token payload without a subject', async () => {
    oauthClientMock.verifyIdToken.mockResolvedValue({
      getPayload: () => ({}),
    });

    await expect(service.verifyIdToken('google-id-token')).rejects.toThrow(
      'Invalid Google ID token payload',
    );
  });

  it('propagates an ID token verification error', async () => {
    oauthClientMock.verifyIdToken.mockRejectedValue(
      new Error('Invalid token signature'),
    );

    await expect(
      service.verifyIdToken('invalid-google-id-token'),
    ).rejects.toThrow('Invalid token signature');
  });
});
