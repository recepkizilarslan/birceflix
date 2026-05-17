CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "google_sub" text NOT NULL UNIQUE,
  "email" text NOT NULL UNIQUE,
  "name" text,
  "avatar_url" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_expires_idx" ON "sessions" ("expires_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watched_movies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tmdb_id" integer NOT NULL,
  "imdb_id" text,
  "title" text NOT NULL,
  "poster_path" text,
  "watched_at" timestamptz DEFAULT now() NOT NULL,
  "my_rating" smallint,
  "notes" text,
  CONSTRAINT "watched_rating_range" CHECK ("my_rating" IS NULL OR ("my_rating" BETWEEN 1 AND 10))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watched_user_movie_unique" ON "watched_movies" ("user_id", "tmdb_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watched_user_idx" ON "watched_movies" ("user_id", "watched_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watchlist" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tmdb_id" integer NOT NULL,
  "added_at" timestamptz DEFAULT now() NOT NULL,
  "priority" smallint DEFAULT 0 NOT NULL,
  PRIMARY KEY ("user_id", "tmdb_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "watch_history" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tmdb_id" integer NOT NULL,
  "watched_at" timestamptz DEFAULT now() NOT NULL,
  "my_rating" smallint,
  "location" text,
  "notes" text
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_user_idx" ON "watch_history" ("user_id", "watched_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "history_user_movie_idx" ON "watch_history" ("user_id", "tmdb_id");
