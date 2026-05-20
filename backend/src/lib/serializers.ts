import type { watchedMovies, watchlist } from '../db/schema.js'

export function serializeWatched(r: typeof watchedMovies.$inferSelect) {
  return {
    id: r.id,
    user_id: r.userId,
    tmdb_id: r.tmdbId,
    media_type: r.mediaType,
    imdb_id: r.imdbId,
    title: r.title,
    poster_path: r.posterPath,
    watched_at: r.watchedAt.toISOString(),
    my_rating: r.myRating,
    notes: r.notes,
  }
}

export function serializeWatchlist(r: typeof watchlist.$inferSelect) {
  return {
    user_id: r.userId,
    tmdb_id: r.tmdbId,
    media_type: r.mediaType,
    title: r.title,
    poster_path: r.posterPath,
    added_at: r.addedAt.toISOString(),
    priority: r.priority,
  }
}
