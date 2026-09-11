BEGIN;

ALTER TABLE "stamps" ADD COLUMN "trip_id" UUID;
UPDATE "stamps" s SET "trip_id" = g."trip_id" FROM "genres" g WHERE g."id" = s."genre_id";
ALTER TABLE "stamps" ALTER COLUMN "trip_id" SET NOT NULL;
ALTER TABLE "stamps" ADD CONSTRAINT "stamps_trip_id_fkey"
  FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "stamp_genres" (
  "stamp_id" UUID NOT NULL,
  "genre_id" UUID NOT NULL,
  CONSTRAINT "stamp_genres_pkey" PRIMARY KEY ("stamp_id", "genre_id"),
  CONSTRAINT "stamp_genres_stamp_id_fkey" FOREIGN KEY ("stamp_id") REFERENCES "stamps"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stamp_genres_genre_id_fkey" FOREIGN KEY ("genre_id") REFERENCES "genres"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "stamp_genres" ("stamp_id", "genre_id") SELECT "id", "genre_id" FROM "stamps";
CREATE INDEX "stamp_genres_genre_id_stamp_id_idx" ON "stamp_genres"("genre_id", "stamp_id");
CREATE INDEX "stamps_trip_id_created_at_id_idx" ON "stamps"("trip_id", "created_at", "id");
ALTER TABLE "stamps" DROP COLUMN "genre_id";

COMMIT;
