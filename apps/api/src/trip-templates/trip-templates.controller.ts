import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard.js';
import {
  PreviewTripTemplateDto,
  TripTemplateCatalogQueryDto,
} from './dto/preview-trip-template.dto.js';
import { TripTemplatesService } from './trip-templates.service.js';

@UseGuards(JwtAuthGuard, ActiveUserGuard)
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
@Controller('trip-templates')
export class TripTemplatesController {
  constructor(private readonly tripTemplatesService: TripTemplatesService) {}

  @Get('presets')
  presets(@Query() _query: TripTemplateCatalogQueryDto) {
    return this.tripTemplatesService.catalog();
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() dto: PreviewTripTemplateDto) {
    return this.tripTemplatesService.preview(dto);
  }
}
