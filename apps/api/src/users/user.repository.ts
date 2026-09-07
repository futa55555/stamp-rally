import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, type User as PrismaUser } from '../generated/prisma/client.js';
import { User, UserNameTakenError } from './entities/user.entity.js';

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
    try {
      const savedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: { name: user.name, status: user.status },
      });

      return this.toDomain(savedUser);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new UserNameTakenError();
      }

      throw error;
    }
  }

  async findActiveByName(
    name: string,
  ): Promise<{ id: string; name: string } | null> {
    const user = await this.prisma.user.findFirst({
      where: { name, status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    return user?.name ? { id: user.id, name: user.name } : null;
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
