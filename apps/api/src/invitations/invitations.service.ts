import { Injectable } from '@nestjs/common';
import { InvitationRepository } from './invitation.repository.js';

// Keep the injectable service as the HTTP boundary; authorization and all
// transactional state transitions live together in the repository.
@Injectable()
export class InvitationsService extends InvitationRepository {}
