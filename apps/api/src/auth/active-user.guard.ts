import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './jwt-auth/jwt-auth.guard.js';
import { PrismaService } from '../database/prisma.service.js';
import { UserStatus } from '../generated/prisma/enums.js';

@Injectable()
export class ActiveUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.auth) throw new UnauthorizedException('Invalid access token');
    const user = await this.prisma.user.findUnique({
      where: { id: request.auth.userId },
      select: { status: true },
    });
    if (!user) throw new UnauthorizedException('User not found');
    if (user.status !== UserStatus.ACTIVE)
      throw new ForbiddenException('Complete onboarding first');
    return true;
  }
}
