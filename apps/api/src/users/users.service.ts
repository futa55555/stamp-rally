import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto.js';
import {
  InvalidUserNameError,
  User,
  UserNameTakenError,
} from './entities/user.entity.js';
import { UserRepository } from './user.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

  async getMe(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateMe(userId: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.getMe(userId);

    try {
      user.updateName(dto.name);

      return await this.userRepository.save(user);
    } catch (error) {
      if (error instanceof InvalidUserNameError) {
        throw new BadRequestException(error.message);
      }

      if (error instanceof UserNameTakenError) {
        throw new ConflictException(error.message);
      }

      throw error;
    }
  }

  async lookup(
    userId: string,
    name: string,
  ): Promise<{ id: string; name: string }> {
    const requester = await this.getMe(userId);

    if (requester.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Complete onboarding before looking up users',
      );
    }

    const user = await this.userRepository.findActiveByName(name.trim());

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
