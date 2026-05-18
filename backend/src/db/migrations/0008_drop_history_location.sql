-- Drop the per-viewing "location" field on watch_history. The UX never
-- justified asking the user "where did you watch this?" — it was noise
-- on the timeline and powered a stat we no longer expose.

ALTER TABLE "watch_history" DROP COLUMN IF EXISTS "location";
