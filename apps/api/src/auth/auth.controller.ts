import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AppleLoginDto } from './dto/apple-login.dto.js';
import { GoogleLoginDto } from './dto/google-login.dto.js';
import { RefreshSessionDto } from './dto/refresh-session.dto.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from './jwt-auth/jwt-auth.guard.js';
import type { SessionTokens } from './session/session.service.js';

@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('google')
  @HttpCode(HttpStatus.OK)
  loginWithGoogle(@Body() dto: GoogleLoginDto): Promise<SessionTokens> {
    return this.authService.loginWithGoogle(dto.idToken);
  }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  loginWithApple(@Body() dto: AppleLoginDto): Promise<SessionTokens> {
    return this.authService.loginWithApple(dto.identityToken, dto.nonce);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshSessionDto): Promise<SessionTokens> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() request: AuthenticatedRequest): Promise<void> {
    return this.authService.logout(request.auth.sessionId);
  }
}
