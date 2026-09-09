import {
  Body,
  Controller,
  Header,
  HttpCode,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { IsString, MaxLength } from 'class-validator';
import { InvitationsService } from './invitations.service.js';

class PublicInvitationTokenDto {
  @IsString()
  @MaxLength(512)
  token!: string;
}

@Controller('public/invitation-links')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class PublicInvitationLinksController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post('status')
  @HttpCode(200)
  @Header('Cache-Control', 'no-store')
  async status(@Body() dto: PublicInvitationTokenDto) {
    return this.invitations.publicStatus(dto.token);
  }
}
