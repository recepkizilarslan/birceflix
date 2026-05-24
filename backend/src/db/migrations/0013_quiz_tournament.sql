-- Migration: 0013_quiz_tournament
-- Adds the three tables that power the 1v1 tournament quiz feature.

-- -----------------------------------------------------------------------
-- quiz_sessions: one row per tournament run
-- -----------------------------------------------------------------------
CREATE TABLE "quiz_sessions" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id"           uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "category"          text NOT NULL,
  "category_label"    text NOT NULL,
  "total_items"       integer NOT NULL,
  "current_round"     integer NOT NULL DEFAULT 1,
  "remaining"         jsonb NOT NULL,
  "eliminated"        jsonb NOT NULL DEFAULT '[]'::jsonb,
  "winner_id"         integer,
  "winner_title"      text,
  "winner_poster_path" text,
  "completed_at"      timestamptz,
  "created_at"        timestamptz DEFAULT now() NOT NULL,
  "updated_at"        timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "quiz_sessions_user_idx"        ON "quiz_sessions" ("user_id", "created_at");
CREATE INDEX "quiz_sessions_user_active_idx" ON "quiz_sessions" ("user_id", "category");

-- -----------------------------------------------------------------------
-- quiz_votes: one row per 1v1 pick within a session
-- -----------------------------------------------------------------------
CREATE TABLE "quiz_votes" (
  "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "session_id"  uuid NOT NULL REFERENCES "quiz_sessions"("id") ON DELETE CASCADE,
  "user_id"     uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "round"       integer NOT NULL,
  "candidate_a" integer NOT NULL,
  "candidate_b" integer NOT NULL,
  "winner"      integer NOT NULL,
  "voted_at"    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX "quiz_votes_session_idx" ON "quiz_votes" ("session_id", "round");
CREATE INDEX "quiz_votes_user_idx"    ON "quiz_votes" ("user_id", "voted_at");

-- -----------------------------------------------------------------------
-- quiz_global_stats: aggregate win counts per (a,b) pair
-- Convention: candidate_a < candidate_b  (enforced by application layer)
-- -----------------------------------------------------------------------
CREATE TABLE "quiz_global_stats" (
  "candidate_a" integer NOT NULL,
  "candidate_b" integer NOT NULL,
  "media_type"  text NOT NULL,
  "wins_a"      integer NOT NULL DEFAULT 0,
  "wins_b"      integer NOT NULL DEFAULT 0,
  "updated_at"  timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("candidate_a", "candidate_b", "media_type")
);
