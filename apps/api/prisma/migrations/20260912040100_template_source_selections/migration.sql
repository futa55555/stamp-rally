ALTER TABLE trips ADD COLUMN template_source_selections JSONB NOT NULL DEFAULT '{}'::jsonb;
