import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { CreateStampDto } from './dto/create-stamp.dto.js';
import { ListStampsDto } from './dto/list-stamps.dto.js';
import { UpdateStampDto } from './dto/update-stamp.dto.js';
import { StampsService } from './stamps.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('stamps')
export class StampsController {
  constructor(private readonly stampsService: StampsService) {}

  @Post()
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateStampDto) {
    return this.stampsService.create(request.auth.userId, dto);
  }

  @Get()
  findAll(@Req() request: AuthenticatedRequest, @Query() query: ListStampsDto) {
    return this.stampsService.findAll(request.auth.userId, query);
  }

  @Get(':id')
  findOne(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.stampsService.findOne(request.auth.userId, id);
  }

  @Patch(':id')
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStampDto,
  ) {
    return this.stampsService.update(request.auth.userId, id, dto);
  }
}
