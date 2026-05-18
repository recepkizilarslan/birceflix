-- Until now `watched_movies` and `watchlist` were keyed by (user_id, tmdb_id)
-- and silently assumed every row was a movie. Adding `media_type` so TV shows
-- can share these tables — the alternative (separate watched_tv_shows /
-- tv_watchlist tables) would force every list-rendering path to do a UNION
-- and there's no real downside to a single typed column.

ALTER TABLE "watched_movies" ADD COLUMN IF NOT EXISTS "media_type" text NOT NULL DEFAULT 'movie';
--> statement-breakpoint
ALTER TABLE "watchlist"      ADD COLUMN IF NOT EXISTS "media_type" text NOT NULL DEFAULT 'movie';
--> statement-breakpoint

-- Replace the old uniqueness constraints with media-type-aware versions.
-- TMDB movie 550 and TV 550 are different entities; we want both rows.
DROP INDEX IF EXISTS "watched_user_movie_unique";
--> statement-breakpoint
CREATE UNIQUE INDEX "watched_user_tmdb_type_unique" ON "watched_movies" ("user_id", "tmdb_id", "media_type");
--> statement-breakpoint

-- watchlist used a composite PK (user_id, tmdb_id). Need to drop + recreate
-- with media_type included.
ALTER TABLE "watchlist" DROP CONSTRAINT IF EXISTS "watchlist_user_id_tmdb_id_pk";
--> statement-breakpoint
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_user_id_tmdb_id_media_type_pk" PRIMARY KEY ("user_id", "tmdb_id", "media_type");
