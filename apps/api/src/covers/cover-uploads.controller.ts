import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Equals, IsInt, IsUUID, Max, Min } from 'class-validator';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { IMAGE_MAX_BYTES } from '../media-processing/media-processor.service.js';
import { CoverAssetsService } from './cover-assets.service.js';

export class CreateCoverDto {
  @IsUUID() clientRequestId!: string;
  @Equals('image/png') mimeType!: string;
  @IsInt() @Min(1) @Max(IMAGE_MAX_BYTES) byteSize!: number;
}

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('uploads/covers')
export class CoverUploadsController {
  constructor(private readonly covers: CoverAssetsService) {}
  @Post() create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateCoverDto,
  ) {
    return this.covers.create(req.auth.userId, dto);
  }
  @Get(':id') get(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.covers.get(req.auth.userId, id);
  }
  @Post(':id/complete') complete(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.covers.complete(req.auth.userId, id);
  }
  @Delete(':id') @HttpCode(204) cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.covers.cancel(req.auth.userId, id);
  }
}
