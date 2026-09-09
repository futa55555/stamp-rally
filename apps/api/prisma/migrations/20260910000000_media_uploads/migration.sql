CREATE TYPE "MediaStatus" AS ENUM ('LEGACY', 'PENDING', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED');
CREATE TABLE "upload_batches" (
  "id" UUID NOT NULL,
  "author_id" UUID NOT NULL,
  "client_request_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "upload_batches_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "upload_batches_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "upload_batches_author_id_client_request_id_key" ON "upload_batches"("author_id", "client_request_id");
CREATE INDEX "upload_batches_created_at_idx" ON "upload_batches"("created_at");
CREATE TABLE "media_cleanup" (
  "id" UUID NOT NULL,
  "keys" TEXT[] NOT NULL,
  "multipart_key" TEXT,
  "multipart_upload_id" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_cleanup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "media_cleanup_created_at_idx" ON "media_cleanup"("created_at");
ALTER TABLE "posts"
  ALTER COLUMN "media_url" DROP NOT NULL,
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'LEGACY',
  ADD COLUMN "original_key" TEXT,
  ADD COLUMN "large_key" TEXT,
  ADD COLUMN "small_key" TEXT,
  ADD COLUMN "playback_key" TEXT,
  ADD COLUMN "blurhash" TEXT,
  ADD COLUMN "file_name" VARCHAR(255),
  ADD COLUMN "mime_type" VARCHAR(127),
  ADD COLUMN "byte_size" INTEGER,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "duration" DOUBLE PRECISION,
  ADD COLUMN "upload_batch_id" UUID,
  ADD COLUMN "client_id" VARCHAR(128),
  ADD COLUMN "staging_key" TEXT,
  ADD COLUMN "multipart_upload_id" TEXT,
  ADD COLUMN "upload_expires_at" TIMESTAMPTZ(3),
  ADD COLUMN "error_code" VARCHAR(100),
  ADD COLUMN "processing_version" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processing_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "processing_started_at" TIMESTAMPTZ(3),
  ADD COLUMN "ready_at" TIMESTAMPTZ(3),
  ADD COLUMN "is_legacy" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "posts_upload_batch_id_fkey" FOREIGN KEY ("upload_batch_id") REFERENCES "upload_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "posts" SET "is_legacy" = true;
ALTER TABLE "posts" ALTER COLUMN "status" SET DEFAULT 'PENDING';
CREATE INDEX "posts_status_upload_expires_at_idx" ON "posts"("status", "upload_expires_at");
CREATE INDEX "posts_upload_batch_id_idx" ON "posts"("upload_batch_id");
CREATE INDEX "posts_stamp_id_status_created_at_id_idx" ON "posts"("stamp_id", "status", "created_at", "id");
-- Keys must remain available for cleanup even when a parent is cascade-deleted.
CREATE FUNCTION queue_deleted_post_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO media_cleanup (id, keys, multipart_key, multipart_upload_id, created_at)
    VALUES (gen_random_uuid(), ARRAY_REMOVE(ARRAY[OLD.original_key, OLD.large_key, OLD.small_key, OLD.playback_key, OLD.staging_key], NULL), OLD.staging_key, OLD.multipart_upload_id, CURRENT_TIMESTAMP + INTERVAL '20 minutes');
  RETURN OLD;
END;
$$;
CREATE TRIGGER posts_media_cleanup BEFORE DELETE ON posts FOR EACH ROW EXECUTE FUNCTION queue_deleted_post_media();
