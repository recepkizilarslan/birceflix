-- `list_items` was keyed on (list_id, tmdb_id) and silently assumed every
-- entry was a movie. TMDB movie 1396 and TV show 1396 are different works,
-- so the same list could not legitimately distinguish them. Adding
-- `media_type` here matches what 0009 did for `watched_movies` / `watchlist`
-- so the UI can route entries to the right detail page and future TV
-- "add to list" flows don't silently collide with movie rows.

ALTER TABLE "list_items" ADD COLUMN IF NOT EXISTS "media_type" text NOT NULL DEFAULT 'movie';
--> statement-breakpoint

-- Replace the old PK with the media-type-aware version. Drizzle's default
-- composite-PK name uses the column list verbatim; we tolerate both the
-- conventional `<table>_pkey` and the Drizzle-style name so a hand-applied
-- earlier env still migrates cleanly.
ALTER TABLE "list_items" DROP CONSTRAINT IF EXISTS "list_items_pkey";
--> statement-breakpoint
ALTER TABLE "list_items" DROP CONSTRAINT IF EXISTS "list_items_list_id_tmdb_id_pk";
--> statement-breakpoint
ALTER TABLE "list_items"
  ADD CONSTRAINT "list_items_list_id_tmdb_id_media_type_pk"
  PRIMARY KEY ("list_id", "tmdb_id", "media_type");
