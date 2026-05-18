-- Per-user Trakt integration state. Null = not connected.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trakt_access_token" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trakt_refresh_token" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trakt_expires_at" timestamptz;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trakt_last_sync_at" timestamptz;
