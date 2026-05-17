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

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listWatched(): Promise<WatchedRow[]> {
  return json<WatchedRow[]>(await fetch('/api/watched', { credentials: 'include' }))
}

export async function markWatched(m: Pick<TmdbMovie, 'id' | 'title' | 'poster_path'> & { imdb_id?: string | null }) {
  await json<{ ok: true }>(await fetch('/api/watched', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tmdb_id: m.id,
      imdb_id: m.imdb_id ?? null,
      title: m.title,
      poster_path: m.poster_path,
    }),
  }))
}

export async function unmarkWatched(tmdb_id: number) {
  await json<{ ok: true }>(await fetch(`/api/watched/${tmdb_id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function getWatchedIdSet(): Promise<Set<number>> {
  try {
    const rows = await listWatched()
    return new Set(rows.map((r) => r.tmdb_id))
  } catch {
    return new Set()
  }
}
