CREATE TABLE "cover_assets" (
  "id" UUID NOT NULL PRIMARY KEY,
  "author_id" UUID REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "client_request_id" UUID NOT NULL,
  "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
  "byte_size" INTEGER NOT NULL,
  "mime_type" VARCHAR(127) NOT NULL,
  "staging_key" TEXT,
  "image_key" TEXT,
  "blurhash" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "error_code" TEXT,
  "processing_attempts" INTEGER NOT NULL DEFAULT 0,
  "processing_started_at" TIMESTAMPTZ(3),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "cover_assets_author_id_client_request_id_key" ON "cover_assets"("author_id", "client_request_id");
CREATE INDEX "cover_assets_status_expires_at_idx" ON "cover_assets"("status", "expires_at");
ALTER TABLE "trips" ADD COLUMN "cover_asset_id" UUID REFERENCES "cover_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE UNIQUE INDEX "trips_cover_asset_id_key" ON "trips"("cover_asset_id");

CREATE FUNCTION queue_deleted_cover_media() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO media_cleanup (id, keys, created_at)
    VALUES (gen_random_uuid(), ARRAY_REMOVE(ARRAY[OLD.image_key, OLD.staging_key], NULL), CURRENT_TIMESTAMP + INTERVAL '20 minutes');
  RETURN OLD;
END;
$$;
CREATE TRIGGER covers_media_cleanup BEFORE DELETE ON cover_assets FOR EACH ROW EXECUTE FUNCTION queue_deleted_cover_media();

-- Detaching a cover and recording its cleanup are part of the trip transaction.
CREATE FUNCTION release_trip_cover() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.cover_asset_id IS NOT DISTINCT FROM NEW.cover_asset_id THEN
    RETURN NEW;
  END IF;
  DELETE FROM cover_assets WHERE id = OLD.cover_asset_id
    AND NOT EXISTS (SELECT 1 FROM trips WHERE cover_asset_id = OLD.cover_asset_id);
  RETURN NULL;
END;
$$;
CREATE TRIGGER trips_cover_replaced AFTER UPDATE OF cover_asset_id ON trips FOR EACH ROW EXECUTE FUNCTION release_trip_cover();
CREATE TRIGGER trips_cover_deleted AFTER DELETE ON trips FOR EACH ROW EXECUTE FUNCTION release_trip_cover();

ALTER TABLE "trips" ADD COLUMN "client_request_id" UUID;
CREATE UNIQUE INDEX "trips_created_by_id_client_request_id_key" ON "trips"("created_by_id", "client_request_id");
