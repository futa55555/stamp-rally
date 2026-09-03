import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthTokenService } from '../auth-token/auth-token.service.js';
import { AuthContext, JwtAuthGuard } from './jwt-auth.guard.js';

const authTokenServiceMock = {
  verifyAccessToken: vi.fn(),
};

function createExecutionContext(authorization?: string) {
  const request: {
    headers: {
      authorization?: string;
    };
    auth?: AuthContext;
  } = {
    headers: {},
  };

  if (authorization) {
    request.headers.authorization = authorization;
  }

  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;

  return {
    context,
    request,
  };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        {
          provide: AuthTokenService,
          useValue: authTokenServiceMock,
        },
      ],
    }).compile();

    guard = moduleRef.get(JwtAuthGuard);
  });

  it('allows a valid access token and attaches auth context', async () => {
    authTokenServiceMock.verifyAccessToken.mockResolvedValue({
      sub: 'user-123',
      sid: 'session-456',
    });

    const { context, request } = createExecutionContext('Bearer access-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);

    expect(authTokenServiceMock.verifyAccessToken).toHaveBeenCalledWith(
      'access-token',
    );

    expect(request.auth).toEqual({
      userId: 'user-123',
      sessionId: 'session-456',
    });
  });

  it('rejects a request without an authorization header', async () => {
    const { context } = createExecutionContext();

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(authTokenServiceMock.verifyAccessToken).not.toHaveBeenCalled();
  });

  it.each(['Basic access-token', 'Bearer', 'Bearer access-token extra'])(
    'rejects a malformed authorization header: %s',
    async (authorization) => {
      const { context } = createExecutionContext(authorization);

      await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );

      expect(authTokenServiceMock.verifyAccessToken).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid access token', async () => {
    authTokenServiceMock.verifyAccessToken.mockRejectedValue(
      new Error('jwt expired'),
    );

    const { context, request } = createExecutionContext('Bearer invalid-token');

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(request.auth).toBeUndefined();
  });
});
