import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { AuthProvider } from '../generated/prisma/enums.js';

@Injectable()
export class AuthAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByIdentity(provider: AuthProvider, providerAccountId: string) {
    const account = await this.prisma.authAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId,
        },
      },
      include: {
        user: true,
      },
    });

    return account?.user ?? null;
  }

  createUserWithIdentity(provider: AuthProvider, providerAccountId: string) {
    return this.prisma.user.create({
      data: {
        name: null,
        accounts: {
          create: {
            provider,
            providerAccountId,
          },
        },
      },
    });
  }
}
