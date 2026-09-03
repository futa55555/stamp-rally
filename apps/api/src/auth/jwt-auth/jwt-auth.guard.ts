import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthTokenService } from '../auth-token/auth-token.service.js';

export type AuthContext = {
  userId: string;
  sessionId: string;
};

export type AuthenticatedRequest = Request & {
  auth: AuthContext;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authTokenService: AuthTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const accessToken = this.extractAccessToken(request);

    if (!accessToken) {
      throw new UnauthorizedException('Invalid access token');
    }

    try {
      const payload =
        await this.authTokenService.verifyAccessToken(accessToken);

      request.auth = {
        userId: payload.sub,
        sessionId: payload.sid,
      };

      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private extractAccessToken(request: Request): string | null {
    const authorization = request.headers.authorization;

    if (!authorization) {
      return null;
    }

    const parts = authorization.trim().split(/\s+/);

    if (parts.length !== 2) {
      return null;
    }

    const [scheme, token] = parts;

    if (scheme.toLowerCase() !== 'bearer' || !token) {
      return null;
    }

    return token;
  }
}
