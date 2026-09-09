ALTER TABLE "notifications" ADD COLUMN "invitation_link_id" UUID;

CREATE INDEX "notifications_invitation_link_id_idx" ON "notifications"("invitation_link_id");
CREATE UNIQUE INDEX "notifications_recipient_id_invitation_link_id_key" ON "notifications"("recipient_id", "invitation_link_id");

ALTER TABLE "notifications" ADD CONSTRAINT "notifications_invitation_link_id_fkey"
  FOREIGN KEY ("invitation_link_id") REFERENCES "invitation_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
