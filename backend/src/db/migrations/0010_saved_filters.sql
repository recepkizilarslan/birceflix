-- Saved discover filters — users can stash a filter combination they like
-- (e.g. "Long Korean movies 2010+ on Netflix") and reapply it from the
-- sidebar. The full FilterState is serialised into the `filters` jsonb;
-- media_type lives in its own column so the UI can label entries by
-- category (Movie / TV / Documentary).

CREATE TABLE IF NOT EXISTS "saved_filters" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "description" text,
  "media_type" text NOT NULL,
  "filters" jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "saved_filters_user_idx"
  ON "saved_filters" ("user_id", "created_at");
