-- The import / export feature (Letterboxd CSVs, Trakt OAuth, Plex/Jellyfin
-- scrobble webhooks, JSON / CSV exports) is being removed end-to-end. All
-- backing routes, lib helpers and UI surfaces have been deleted; this
-- migration drops the DB shape they relied on.
--
-- Dropped tables:
--   webhook_tokens      - per-user opaque tokens for Plex/Jellyfin POST hooks.
--                         No payload was stored on the server, so nothing of
--                         value is lost when the rows go away.
--
-- Dropped columns on users:
--   trakt_access_token  - encrypted OAuth access token (per user).
--   trakt_refresh_token - encrypted OAuth refresh token.
--   trakt_expires_at    - when the access token expires.
--   trakt_last_sync_at  - bookkeeping for the last successful Trakt import.
--
-- Drops are safe even on a fresh / empty DB thanks to IF EXISTS guards.

DROP INDEX IF EXISTS "webhook_tokens_user_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "webhook_tokens";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "trakt_access_token";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "trakt_refresh_token";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "trakt_expires_at";
--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "trakt_last_sync_at";
