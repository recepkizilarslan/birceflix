import { supabase } from './supabase'
import type { TmdbMovie } from './api'

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

export async function listWatched(): Promise<WatchedRow[]> {
  const { data, error } = await supabase
    .from('watched_movies')
    .select('*')
    .order('watched_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function markWatched(m: Pick<TmdbMovie, 'id' | 'title' | 'poster_path'> & { imdb_id?: string | null }) {
  const { data: session } = await supabase.auth.getUser()
  if (!session.user) throw new Error('not signed in')
  const { error } = await supabase.from('watched_movies').upsert(
    {
      user_id: session.user.id,
      tmdb_id: m.id,
      imdb_id: m.imdb_id ?? null,
      title: m.title,
      poster_path: m.poster_path,
    },
    { onConflict: 'user_id,tmdb_id' },
  )
  if (error) throw error
}

export async function unmarkWatched(tmdb_id: number) {
  const { error } = await supabase.from('watched_movies').delete().eq('tmdb_id', tmdb_id)
  if (error) throw error
}

export async function getWatchedIdSet(): Promise<Set<number>> {
  try {
    const rows = await listWatched()
    return new Set(rows.map((r) => r.tmdb_id))
  } catch {
    return new Set()
  }
}
