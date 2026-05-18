-- Per-user webhook tokens for Plex / Jellyfin scrobbler integration.

CREATE TABLE IF NOT EXISTS "webhook_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "label" text NOT NULL,
  "last_used_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_tokens_user_idx" ON "webhook_tokens" ("user_id");
