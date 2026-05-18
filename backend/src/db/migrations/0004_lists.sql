-- User-defined curated lists of movies.
-- "Favori Wes Anderson", "Tatil için listem", etc.

CREATE TABLE IF NOT EXISTS "lists" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "is_public" boolean DEFAULT false NOT NULL,
  "public_slug" text UNIQUE,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "lists_user_idx" ON "lists" ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "list_items" (
  "list_id" uuid NOT NULL REFERENCES "lists"("id") ON DELETE CASCADE,
  "tmdb_id" integer NOT NULL,
  "title" text NOT NULL,
  "poster_path" text,
  "position" smallint DEFAULT 0 NOT NULL,
  "added_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("list_id", "tmdb_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "list_items_list_order_idx"
  ON "list_items" ("list_id", "position", "added_at");
