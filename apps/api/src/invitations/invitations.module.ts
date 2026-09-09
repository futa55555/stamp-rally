import { PublicInvitationLinksController } from './public-invitation-links.controller.js';
import { InvitationLinksController } from './invitation-links.controller.js';
import { CoverAssetsModule } from '../covers/cover-assets.module.js';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TripAccessModule } from '../trips/trip-access.module.js';
import { InvitationRepository } from './invitation.repository.js';
import { InvitationsController } from './invitations.controller.js';
import { InvitationsService } from './invitations.service.js';
import { TripInvitationsController } from './trip-invitations.controller.js';

@Module({
  imports: [CoverAssetsModule, AuthModule, TripAccessModule],
  controllers: [
    InvitationsController,
    TripInvitationsController,
    InvitationLinksController,
    PublicInvitationLinksController,
  ],
  providers: [
    InvitationRepository,
    { provide: InvitationsService, useExisting: InvitationRepository },
  ],
  exports: [InvitationRepository],
})
export class InvitationsModule {}
