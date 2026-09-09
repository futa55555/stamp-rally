CREATE TABLE "invitation_links" (
  "id" UUID NOT NULL PRIMARY KEY,
  "trip_id" UUID NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_by_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "token_hash" VARCHAR(64) NOT NULL UNIQUE,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "revoked_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "invitation_links_trip_id_created_at_id_idx" ON "invitation_links"("trip_id", "created_at", "id");
CREATE INDEX "invitation_links_created_by_id_idx" ON "invitation_links"("created_by_id");
ALTER TABLE "trip_invitations" ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "link_id" UUID REFERENCES "invitation_links"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ALTER COLUMN "status" SET DEFAULT 'PENDING_CONFIRMATION';
UPDATE "trip_invitations" SET "status" = 'CANCELLED', "updated_at" = CURRENT_TIMESTAMP WHERE "status" = 'PENDING';
ALTER TABLE "notifications" ADD COLUMN "invitation_id" UUID REFERENCES "trip_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_invitation_id_idx" ON "notifications"("invitation_id");
