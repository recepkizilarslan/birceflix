import type { TmdbMovie } from './api'

export interface WatchlistRow {
  user_id: string
  tmdb_id: number
  title: string
  poster_path: string | null
  added_at: string
  priority: number
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.url} -> ${res.status}`)
  return res.json() as Promise<T>
}

export async function listWatchlist(): Promise<WatchlistRow[]> {
  return json<WatchlistRow[]>(await fetch('/api/watchlist', { credentials: 'include' }))
}

export async function addToWatchlist(m: Pick<TmdbMovie, 'id' | 'title' | 'poster_path'>) {
  await json<{ ok: true }>(await fetch('/api/watchlist', {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      tmdb_id: m.id,
      title: m.title,
      poster_path: m.poster_path,
    }),
  }))
}

export async function removeFromWatchlist(tmdb_id: number) {
  await json<{ ok: true }>(await fetch(`/api/watchlist/${tmdb_id}`, {
    method: 'DELETE',
    credentials: 'include',
  }))
}

export async function getWatchlistIdSet(): Promise<Set<number>> {
  try {
    const rows = await listWatchlist()
    return new Set(rows.map((r) => r.tmdb_id))
  } catch {
    return new Set()
  }
}
