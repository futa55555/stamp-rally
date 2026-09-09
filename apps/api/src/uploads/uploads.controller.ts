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
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  type AuthenticatedRequest,
  JwtAuthGuard,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import {
  CompleteUploadDto,
  CreateUploadBatchDto,
  SignUploadPartsDto,
} from './dto/uploads.dto.js';
import { UploadsService } from './uploads.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('batches')
  createBatch(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateUploadBatchDto,
  ) {
    return this.uploads.createBatch(req.auth.userId, dto);
  }

  @Get('batches/:id')
  getBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.uploads.getBatch(req.auth.userId, id);
  }

  @Post(':id/parts')
  signParts(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SignUploadPartsDto,
  ) {
    return this.uploads.signParts(req.auth.userId, id, dto.partNumbers);
  }

  @Get(':id/parts')
  listParts(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.uploads.listParts(req.auth.userId, id);
  }

  @Post(':id/complete')
  complete(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CompleteUploadDto,
  ) {
    return this.uploads.complete(req.auth.userId, id, dto);
  }

  @Post(':id/retry')
  retry(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.uploads.retry(req.auth.userId, id);
  }

  @Delete(':id')
  @HttpCode(204)
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.uploads.cancel(req.auth.userId, id);
  }
}
