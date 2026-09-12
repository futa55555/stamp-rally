import {
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ActiveUserGuard } from '../auth/active-user.guard.js';
import {
  JwtAuthGuard,
  type AuthenticatedRequest,
} from '../auth/jwt-auth/jwt-auth.guard.js';
import { DeletionsService } from './deletions.service.js';

@Controller()
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class DeletionsController {
  constructor(private readonly deletions: DeletionsService) {}
  @Delete('trips/:id')
  @HttpCode(204)
  trip(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.deletions.delete(req.auth.userId, 'trip', id);
  }
  @Delete('categories/:id')
  @HttpCode(204)
  category(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.deletions.delete(req.auth.userId, 'category', id);
  }
  @Delete('stamps/:id')
  @HttpCode(204)
  stamp(
    @Req() req: AuthenticatedRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.deletions.delete(req.auth.userId, 'stamp', id);
  }
}
