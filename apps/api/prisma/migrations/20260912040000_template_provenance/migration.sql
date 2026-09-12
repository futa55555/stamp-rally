-- Existing categories, stamps and memberships remain manual; never infer provenance from names.
ALTER TABLE trips ADD COLUMN template_exclusions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE categories ADD COLUMN template_key VARCHAR(100);
ALTER TABLE stamps ADD COLUMN template_key VARCHAR(100);
ALTER TABLE stamp_categories ADD COLUMN manual BOOLEAN NOT NULL DEFAULT TRUE, ADD COLUMN template_sources TEXT[] NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX categories_active_template_key ON categories(trip_id, template_key) WHERE deleted_at IS NULL AND template_key IS NOT NULL;
CREATE UNIQUE INDEX stamps_active_template_key ON stamps(trip_id, template_key) WHERE deleted_at IS NULL AND template_key IS NOT NULL;
CREATE TABLE trip_edits (
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  payload_hash VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, client_request_id)
);
