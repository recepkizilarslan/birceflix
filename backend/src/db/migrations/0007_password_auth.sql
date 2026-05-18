-- Add password-based authentication. Until now every user had to come
-- through Google OAuth; this lets people register with email + password
-- as well. google_sub goes nullable (password-only users won't have one)
-- but stays unique when present.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "google_sub" DROP NOT NULL;
--> statement-breakpoint
-- email already has a unique index; nothing to add for password_hash.
