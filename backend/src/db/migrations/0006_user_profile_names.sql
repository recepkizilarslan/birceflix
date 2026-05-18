-- Split the display name into first/last so the user can edit each part.
-- Existing `name` stays as a denormalised full-name for places that join
-- on it (e.g. public lists' owner_name). We keep it in sync on writes.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "first_name" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_name" text;
--> statement-breakpoint
-- Best-effort backfill from the existing `name` column for rows that
-- predate this column (split on the first space).
UPDATE "users"
SET first_name = split_part("name", ' ', 1),
    last_name  = NULLIF(regexp_replace("name", '^\S+\s*', ''), '')
WHERE first_name IS NULL AND "name" IS NOT NULL;
