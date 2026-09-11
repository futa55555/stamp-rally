ALTER TABLE "trips"
  ADD COLUMN "activity_presets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "custom_activities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
