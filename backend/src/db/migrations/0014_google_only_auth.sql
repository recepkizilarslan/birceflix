-- Google-only authentication. The email+password register/login endpoints
-- are gone, so the password_hash column has no remaining reader or writer.
--
-- First sweep out the junk accounts that the unverified email+password
-- register flow let in (no proof-of-ownership was ever required, so these
-- are obviously-bogus addresses). Their watch data / sessions cascade.
-- Real legacy password users are intentionally KEPT — they re-attach to
-- their row by signing in with the same Google email (see auth/routes.ts
-- google callback, which links google_sub by verified email).
DELETE FROM "users" WHERE "email" IN ('a@example.com', 'abc@gmail.com');
--> statement-breakpoint
-- Now drop the unused column. google_sub stays nullable: a kept legacy
-- account has a null google_sub until its owner's first Google sign-in.
ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash";
