BEGIN;
ALTER TABLE genres RENAME TO categories;
ALTER TABLE categories RENAME CONSTRAINT genres_pkey TO categories_pkey;
ALTER TABLE categories RENAME CONSTRAINT genres_trip_id_fkey TO categories_trip_id_fkey;
ALTER INDEX genres_trip_id_created_at_id_idx RENAME TO categories_trip_id_created_at_id_idx;
ALTER TABLE stamp_genres RENAME TO stamp_categories;
ALTER TABLE stamp_categories RENAME COLUMN genre_id TO category_id;
ALTER TABLE stamp_categories RENAME CONSTRAINT stamp_genres_pkey TO stamp_categories_pkey;
ALTER TABLE stamp_categories RENAME CONSTRAINT stamp_genres_stamp_id_fkey TO stamp_categories_stamp_id_fkey;
ALTER TABLE stamp_categories RENAME CONSTRAINT stamp_genres_genre_id_fkey TO stamp_categories_category_id_fkey;
ALTER INDEX stamp_genres_genre_id_stamp_id_idx RENAME TO stamp_categories_category_id_stamp_id_idx;
UPDATE notifications
SET target = (target - 'genreId') || jsonb_build_object('type', 'category', 'categoryId', target->'genreId')
WHERE target->>'type' = 'genre';
UPDATE notifications SET title = replace(title, 'ジャンル', 'カテゴリー')
WHERE title IN ('ジャンルが作成されました', 'ジャンルが更新されました');
COMMIT;
