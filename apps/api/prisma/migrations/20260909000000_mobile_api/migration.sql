ALTER TABLE "trips" ADD COLUMN "locations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE TABLE "photo_reads" (
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "post_id" UUID NOT NULL REFERENCES "posts"("id") ON DELETE CASCADE,
  "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("user_id", "post_id")
);
CREATE INDEX "photo_reads_post_id_idx" ON "photo_reads"("post_id");
CREATE TABLE "notifications" (
  "id" UUID NOT NULL PRIMARY KEY,
  "recipient_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "trip_id" UUID NOT NULL REFERENCES "trips"("id") ON DELETE CASCADE,
  "post_id" UUID REFERENCES "posts"("id") ON DELETE CASCADE,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "target" JSONB NOT NULL,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "notifications_recipient_id_created_at_id_idx" ON "notifications"("recipient_id", "created_at", "id");
CREATE INDEX "notifications_recipient_id_read_at_idx" ON "notifications"("recipient_id", "read_at");
CREATE INDEX "notifications_trip_id_idx" ON "notifications"("trip_id");
CREATE INDEX "notifications_post_id_idx" ON "notifications"("post_id");
