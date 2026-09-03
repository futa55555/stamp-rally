import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { InvalidUserNameError, User } from './entities/user.entity.js';
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
    } catch (error) {
      if (error instanceof InvalidUserNameError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }

    return this.userRepository.save(user);
  }
}
