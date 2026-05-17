/**
 * API contract types shared between backend and frontend.
 * Keep this file pure-types only (no runtime code) — both packages import it.
 */

export interface AuthUser {
  id: string
  email: string
  name: string | null
  avatar_url: string | null
}

export interface WatchedRow {
  id: string
  user_id: string
  tmdb_id: number
  imdb_id: string | null
  title: string
  poster_path: string | null
  watched_at: string
  my_rating: number | null
  notes: string | null
}

export interface MarkWatchedRequest {
  tmdb_id: number
  imdb_id?: string | null
  title: string
  poster_path?: string | null
  my_rating?: number | null
  notes?: string | null
}

export interface WatchlistItem {
  user_id: string
  tmdb_id: number
  added_at: string
  priority: number
}
