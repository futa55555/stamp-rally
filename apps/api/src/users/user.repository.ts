import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import type { User as PrismaUser } from '../generated/prisma/client.js';
import { User } from './entities/user.entity.js';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({
      where: { id },
    });

    return user ? this.toDomain(user) : null;
  }

  async save(user: User): Promise<User> {
    const savedUser = await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name: user.name,
        status: user.status,
      },
    });

    return this.toDomain(savedUser);
  }

  private toDomain(user: PrismaUser): User {
    return new User(
      user.id,
      user.name,
      user.status,
      user.createdAt,
      user.updatedAt,
    );
  }
}
