-- The per-viewing-event "watch history" feature is being dropped. The UI
-- piece ("İzleme geçmişim" timeline on the movie detail page) was never
-- meaningfully used — users mark titles as watched or not, rewatch tracking
-- never paid for its own complexity. The watched_movies row remains the
-- source of truth for "user has seen this".
--
-- Drops are non-destructive at the application level — the table only
-- carried a tmdb_id back-reference, a watched_at timestamp, and an optional
-- rating/note. Anything worth preserving (rating, notes) already lives on
-- watched_movies; what we lose is multiple-viewings-per-title history.

DROP INDEX IF EXISTS "history_user_idx";
--> statement-breakpoint
DROP INDEX IF EXISTS "history_user_movie_idx";
--> statement-breakpoint
DROP TABLE IF EXISTS "watch_history";
