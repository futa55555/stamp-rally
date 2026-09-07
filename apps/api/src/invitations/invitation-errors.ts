import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  InvitationConflictError,
  InvitationNotFoundError,
} from './entities/invitation.entity.js';

export function rethrowInvitationError(error: unknown): never {
  if (error instanceof InvitationConflictError) {
    throw new ConflictException(error.message);
  }
  if (error instanceof InvitationNotFoundError) {
    throw new NotFoundException(error.message);
  }
  throw error;
}
