ALTER TABLE trips ADD COLUMN deleted_at TIMESTAMPTZ(3);
ALTER TABLE categories ADD COLUMN deleted_at TIMESTAMPTZ(3);
ALTER TABLE stamps ADD COLUMN deleted_at TIMESTAMPTZ(3);
ALTER TABLE posts ADD COLUMN deleted_at TIMESTAMPTZ(3), ADD COLUMN purged_at TIMESTAMPTZ(3);
ALTER TABLE posts ADD CONSTRAINT posts_purged_requires_deleted CHECK (purged_at IS NULL OR deleted_at IS NOT NULL);
CREATE INDEX posts_deleted_at_id_idx ON posts(deleted_at, id);
