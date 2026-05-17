-- Denormalise title + poster_path onto watchlist so the list page can render
-- without a TMDB round-trip per row. Same pattern as watched_movies.

ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "title" text;
--> statement-breakpoint
ALTER TABLE "watchlist" ADD COLUMN IF NOT EXISTS "poster_path" text;
--> statement-breakpoint
-- Backfill anything that pre-existed (no real rows yet, but safe).
UPDATE "watchlist" SET "title" = '?' WHERE "title" IS NULL;
--> statement-breakpoint
ALTER TABLE "watchlist" ALTER COLUMN "title" SET NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watchlist_user_added_idx" ON "watchlist" ("user_id", "added_at");
