import {
  Body,
  Controller,
  Get,
  Patch,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './entities/user.entity.js';
import { UsersService } from './users.service.js';

@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@Req() request: AuthenticatedRequest): Promise<User> {
    return this.usersService.getMe(request.auth.userId);
  }

  @Patch('me')
  updateMe(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateMe(request.auth.userId, dto);
  }
}
