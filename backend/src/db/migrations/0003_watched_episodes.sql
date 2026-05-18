-- Per-user TV episode watch tracking. One row per (user, show, season, episode).

CREATE TABLE IF NOT EXISTS "watched_episodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "show_id" integer NOT NULL,
  "show_name" text NOT NULL,
  "show_poster_path" text,
  "season_number" integer NOT NULL,
  "episode_number" integer NOT NULL,
  "episode_name" text,
  "watched_at" timestamptz DEFAULT now() NOT NULL,
  "my_rating" smallint,
  "notes" text,
  CONSTRAINT "watched_episodes_rating_range"
    CHECK ("my_rating" IS NULL OR ("my_rating" BETWEEN 1 AND 10))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watched_episodes_user_unique"
  ON "watched_episodes" ("user_id", "show_id", "season_number", "episode_number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watched_episodes_user_show_idx"
  ON "watched_episodes" ("user_id", "show_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watched_episodes_user_time_idx"
  ON "watched_episodes" ("user_id", "watched_at");
